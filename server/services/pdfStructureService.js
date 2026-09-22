import fs from "fs/promises";
import { pngFromPdfjsImage } from "../utils/pngEncoder.js";

let createCanvas = null;
try {
  const canvasModule = await import("@napi-rs/canvas");
  createCanvas = canvasModule.createCanvas;
} catch {
  // @napi-rs/canvas fallback if unavailable
}

/**
 * PDF -> editable document structure.
 *
 * The PDF is treated as an *imported document*: its pages are read once, their
 * layout is interpreted, and the result is an editable tree. Nothing here tries
 * to rewrite the original PDF's drawing instructions, because text reflow - the
 * whole point of editing - is impossible if you do.
 *
 * What the structure preserves is the *page*: every block of text keeps the
 * position, width, font size, family, weight and alignment it had in the file,
 * inside a page of the original size. That is what makes the workspace show a
 * PDF that looks like the PDF rather than a re-flowed approximation of it, and
 * it is what the exporter draws back out. Reading order is kept as well, so the
 * outline and the similarity engine still see a document.
 *
 * The document is returned to the client and never stored on the report row: the
 * PDF file on disk stays the single source of truth, so this runs again on every
 * fresh session and cannot drift from the file.
 *
 * pdfjs-dist is loaded lazily. It is present in node_modules as a dependency of
 * pdf-parse, and loading it on demand means a missing copy breaks only the PDF
 * workspace endpoints with an actionable message instead of taking down the API
 * at import time.
 */

const PDFJS_SPECIFIER = "pdfjs-dist/legacy/build/pdf.mjs";

let pdfjsPromise = null;

const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_SPECIFIER).catch((error) => {
      pdfjsPromise = null;
      throw new Error(`The PDF reader could not be loaded (${error.message}).`);
    });
  }
  return pdfjsPromise;
};

// --- tuning -----------------------------------------------------------------
// Named rather than inlined so it is obvious what has to be re-tuned if
// extraction quality ever needs adjusting.
const LINE_TOLERANCE_RATIO = 0.4; // of font size, for "same baseline"
const WORD_GAP_RATIO = 0.22; // of font size, for "a space belongs here"
const PARAGRAPH_GAP_RATIO = 0.62; // of font size, for "new paragraph"
// Wider than any normal space, so it marks a column break rather than a gap
// between words (justified text stretches spaces, but not this far).
const COLUMN_GAP_RATIO = 1.6;
// Lines whose left edges are within this many points belong to the same column.
const COLUMN_LEFT_TOLERANCE = 10;
const INDENT_SHIFT_POINTS = 16;
const SHORT_LINE_RATIO = 0.62; // of the page text width
const HEADER_BAND_RATIO = 0.075; // of page height, top and bottom
const REPEATED_LINE_RATIO = 0.4; // of pages a line must appear on to be chrome
const MIN_BODY_FONT = 1;
const MIN_FIGURE_WIDTH = 4; // points; below this it is a bullet or an icon
const MIN_FIGURE_HEIGHT = 4;
const MAX_FIGURES = 60;
const MAX_FIGURE_BYTES = 1_200_000;
const MAX_FIGURE_TOTAL_BYTES = 8_000_000;
const MAX_FIGURE_PIXELS = 6_000_000;
const OBJECT_RESOLVE_TIMEOUT_MS = 100;
// Slack added to a block's measured width so that re-wrapping in a browser font
// does not produce an extra line where the original had none.
const WRAP_SLACK_POINTS = 2.5;

const SECTION_NAMES = [
  "abstract", "introduction", "general introduction", "conclusion", "general conclusion",
  "acknowledgement", "acknowledgements", "dedication", "table of contents", "contents",
  "list of figures", "list of tables", "list of abbreviations", "abbreviations",
  "glossary", "bibliography", "references", "webography", "videography", "resume",
  "résumé", "executive summary", "summary", "appendix", "annex", "perspectives",
];

const round = (value) => Math.round(value * 100) / 100;

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

/** Digits become '#' so "Page 4 of 20" and "Page 5 of 20" compare equal. */
const chromeKey = (text) => normalizeText(text).toLowerCase().replace(/\d+/g, "#");

const makeTextNode = (text, marks) => (marks?.length ? { type: "text", text, marks } : { type: "text", text });

// --- fonts ------------------------------------------------------------------

/**
 * What a font name actually is.
 *
 * `getTextContent` only reports a generic family ("sans-serif"), which is not
 * enough to keep bold headings bold. The real font - with its weight and slant -
 * is available from the page's common objects once the page has been painted,
 * which is why the operator list is requested before this is read.
 */
const resolveFonts = async (page, fontNames) => {
  const resolved = new Map();

  const fontTasks = Array.from(fontNames).map(async (fontName) => {
    let entry = null;
    if (page.commonObjs && typeof page.commonObjs.has === "function" && page.commonObjs.has(fontName)) {
      try {
        entry = page.commonObjs.get(fontName);
      } catch {
        entry = null;
      }
    }

    if (!entry) {
      entry = await new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        try {
          page.commonObjs.get(fontName, finish);
        } catch {
          finish(null);
        }
        setTimeout(() => finish(null), 50);
      });
    }

    if (!entry) {
      resolved.set(fontName, { bold: false, italic: false, name: null });
      return;
    }

    resolved.set(fontName, {
      bold: Boolean(entry.bold) || /bold|black|heavy|semibold|demibold/i.test(entry.name || ""),
      italic: Boolean(entry.italic) || /italic|oblique/i.test(entry.name || ""),
      // Subset prefixes ("ABCDEF+") and style suffixes are noise for display.
      name: String(entry.name || "").replace(/^[A-Z]{6}\+/, "").replace(/[-,](Bold|Italic|Oblique|Regular|MT|PSMT|Roman)+$/gi, "") || null,
    });
  });

  await Promise.all(fontTasks);
  return resolved;
};

// --- line assembly ----------------------------------------------------------

/**
 * One visual line: words merged into runs of identical styling, with the
 * geometry the page gave them. A PDF's own line breaks are a consequence of its
 * layout, not of the text, so paragraphs are rebuilt from these afterwards.
 */
const buildLines = (textContent, viewport, fonts) => {
  const styles = textContent.styles || {};
  const items = [];

  for (const item of textContent.items) {
    if (!item || typeof item.str !== "string" || !item.str.trim()) continue;
    if (!Array.isArray(item.transform)) continue;

    const rawSize = Math.abs(item.height) || Math.abs(item.transform[3]) || item.fontSize || 0;
    const fontSize = rawSize > 0 ? rawSize : 10;

    const style = styles[item.fontName] || {};
    const font = fonts.get(item.fontName) || { bold: false, italic: false, name: null };
    const ascent = Number.isFinite(style.ascent) ? style.ascent : 0.8;
    const descent = Number.isFinite(style.descent) ? style.descent : -0.2;
    const baseline = item.transform[5];

    items.push({
      text: item.str,
      x: item.transform[4],
      baseline,
      width: Math.abs(item.width) || 0,
      fontSize,
      fontFamily: style.fontFamily || "sans-serif",
      fontName: font.name,
      bold: font.bold,
      italic: font.italic,
      // How far the baseline sits below the top of the line box. Kept because it
      // is what lets the exporter put the baseline back exactly where it was -
      // without it, every save would nudge the text down a little.
      ascent,
      // Top/bottom are flipped into reading order (PDF measures y upwards).
      top: viewport.height - (baseline + fontSize * ascent),
      bottom: viewport.height - (baseline + fontSize * descent),
    });
  }

  if (!items.length) return [];

  items.sort((a, b) => (b.baseline - a.baseline) || (a.x - b.x));

  // How wide is a space on this page? A fixed threshold cannot tell a layout gap
  // from a word gap across documents set at different sizes and tracking, so the
  // page's own median word gap is measured and a gap several times larger is
  // treated as a layout break (a column, a tab stop, a table cell).
  const measuredGaps = [];
  for (let i = 1; i < items.length; i += 1) {
    const previous = items[i - 1];
    const item = items[i];
    if (Math.abs(previous.baseline - item.baseline) > 1.5) continue;
    const gap = item.x - (previous.x + previous.width);
    if (gap > 0 && gap < item.fontSize) measuredGaps.push(gap);
  }
  measuredGaps.sort((a, b) => a - b);
  const medianWordGap = measuredGaps.length >= 8 ? measuredGaps[Math.floor(measuredGaps.length / 2)] : null;

  const lines = [];
  let current = null;

  const sameStyle = (run, item) => run.bold === item.bold && run.italic === item.italic
    && run.fontName === item.fontName && Math.abs(run.fontSize - item.fontSize) < 0.35;

  for (const item of items) {
    const tolerance = Math.max(1.2, item.fontSize * LINE_TOLERANCE_RATIO);
    const gap = current ? item.x - current.lastRight : 0;
    // A gap this wide is not a word space: it is a column break, a tab stop or a
    // table cell. Joining across it is what turned a two-column cover page into
    // one run of text with both languages spliced together.
    const breakGap = Math.max(
      item.fontSize * 0.7,
      Math.min(item.fontSize * COLUMN_GAP_RATIO, medianWordGap ? medianWordGap * 4 : Infinity),
    );
    const columnBreak = Boolean(current) && gap > breakGap;

    if (!current || columnBreak || Math.abs(current.baseline - item.baseline) > tolerance) {
      current = {
        // `item` here is the normalised entry above, whose text lives in `text`.
        runs: [{ text: item.text, bold: item.bold, italic: item.italic, fontName: item.fontName, fontSize: item.fontSize }],
        baseline: item.baseline,
        left: item.x,
        right: item.x + item.width,
        // Where the last word ended, which is what says whether the next item is
        // a new word or a continuation.
        lastRight: item.x + item.width,
        top: item.top,
        bottom: item.bottom,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily,
        ascent: item.ascent,
      };
      lines.push(current);
      continue;
    }

    const previousRun = current.runs[current.runs.length - 1];
    const needsSpace = gap > item.fontSize * WORD_GAP_RATIO
      && !/\s$/.test(previousRun.text)
      && !/^\s/.test(item.text);

    if (needsSpace) previousRun.text += " ";

    if (sameStyle(previousRun, item)) {
      previousRun.text += item.text;
    } else {
      current.runs.push({ text: item.text, bold: item.bold, italic: item.italic, fontName: item.fontName, fontSize: item.fontSize });
    }

    current.right = Math.max(current.right, item.x + item.width);
    current.lastRight = Math.max(current.lastRight, item.x + item.width);
    current.left = Math.min(current.left, item.x);
    current.top = Math.min(current.top, item.top);
    current.bottom = Math.max(current.bottom, item.bottom);
    if (item.fontSize > current.fontSize) {
      current.fontSize = item.fontSize;
      current.fontFamily = item.fontFamily;
    }
  }

  return lines.map((line) => ({
    runs: line.runs
      .map((run) => ({ ...run, text: run.text }))
      .filter((run) => run.text.length > 0),
    text: normalizeText(line.runs.map((run) => run.text).join("")),
    baseline: line.baseline,
    left: line.left,
    right: line.right,
    width: line.right - line.left,
    top: line.top,
    bottom: line.bottom,
    fontSize: line.fontSize,
    fontFamily: line.fontFamily,
    ascent: line.ascent,
  })).filter((line) => line.text);
};

// --- paragraph assembly -----------------------------------------------------

const startsListItem = (text) => /^([-•*‣▪◦·–—]|\d{1,2}[.)]|[a-z][.)])\s+/i.test(text);

/** Append one line's runs to a paragraph's, de-hyphenating a split word. */
const appendRuns = (paragraph, line) => {
  const last = paragraph.runs[paragraph.runs.length - 1];
  const first = line.runs[0];
  if (!last || !first) return;

  const hyphenated = /[a-z]-$/.test(last.text) && /^[a-z]/.test(first.text);

  if (hyphenated) {
    // "develop-" + "ment" is one word; keeping the hyphen would corrupt the text.
    last.text = `${last.text.slice(0, -1)}${first.text}`;
  } else if (!/[\s-]$/.test(last.text) && !/^\s/.test(first.text)) {
    last.text = `${last.text} ${first.text}`;
  } else {
    last.text += first.text;
  }

  paragraph.runs.push(...line.runs.slice(1).map((run) => ({ ...run })));
};

const buildParagraphs = (lines, pageTextWidth) => {
  const paragraphs = [];

  // Two pieces of text on the same lines of a page (two columns, a table row)
  // must not be merged into one paragraph just because they sit at the same
  // height: a paragraph continues a line only where the two overlap.
  const overlaps = (line, paragraph) => {
    const shared = Math.min(line.right, paragraph.right) - Math.max(line.left, paragraph.left);
    return shared > Math.min(line.width, paragraph.width) * 0.4;
  };

  for (const line of lines) {
    const current = paragraphs[paragraphs.length - 1];
    const newBlock = !current
      || !overlaps(line, current)
      || startsListItem(line.text)
      || startsListItem(current.text) !== startsListItem(line.text)
      || Math.abs(line.left - current.left) > INDENT_SHIFT_POINTS
      || Math.abs(line.fontSize - current.fontSize) > Math.max(0.6, current.fontSize * 0.12)
      || line.top - current.bottom > Math.max(line.fontSize, current.fontSize) * PARAGRAPH_GAP_RATIO
      // A line that stops well short of the right margin after a full stop is
      // the last line of a paragraph, not a line that happens to be short.
      || (/[.!?:;]["')\]]?$/.test(current.text) && current.width < pageTextWidth * SHORT_LINE_RATIO);

    if (newBlock) {
      paragraphs.push({
        runs: line.runs.map((run) => ({ ...run })),
        text: line.text,
        top: line.top,
        bottom: line.bottom,
        left: line.left,
        right: line.right,
        width: line.width,
        fontSize: line.fontSize,
        fontFamily: line.fontFamily,
        ascent: line.ascent,
        lineTops: [line.top],
        lineBottoms: [line.bottom],
        lineLefts: [line.left],
        lineRights: [line.right],
        baselines: [line.baseline],
      });
      continue;
    }

    appendRuns(current, line);
    current.text = normalizeText(`${current.text} ${line.text}`);
    current.top = Math.min(current.top, line.top);
    current.bottom = Math.max(current.bottom, line.bottom);
    current.left = Math.min(current.left, line.left);
    current.right = Math.max(current.right, line.right);
    current.width = Math.max(current.width, line.width);
    current.lineTops.push(line.top);
    current.lineBottoms.push(line.bottom);
    current.lineLefts.push(line.left);
    current.lineRights.push(line.right);
    current.baselines.push(line.baseline);
  }

  return paragraphs;
};

// --- page reading order -----------------------------------------------------

/**
 * Put a page's lines into reading order: column by column, top to bottom.
 *
 * A page sorted purely by height interleaves the columns of a two-column report
 * - the left column's first line, the right column's first line, the left
 * column's second line - which is exactly the "disorder" a reader sees. Grouping
 * lines whose left edges line up recovers the columns, and each column is then
 * read downwards. Text that is not in a column (a title, a full-width paragraph)
 * forms its own group and stays where it was.
 */
const orderLinesByColumn = (lines) => {
  const bands = [];

  for (const line of [...lines].sort((a, b) => a.left - b.left)) {
    const band = bands.find((candidate) => Math.abs(candidate.left - line.left) <= COLUMN_LEFT_TOLERANCE);
    if (band) {
      band.lines.push(line);
      band.left = Math.min(band.left, line.left);
    } else {
      bands.push({ left: line.left, lines: [line] });
    }
  }

  bands.sort((a, b) => a.left - b.left);
  return bands.flatMap((band) => band.lines.sort((a, b) => a.top - b.top));
};

// --- classification ---------------------------------------------------------

const headingLevelFor = (text, fontSize, bodySize) => {
  const clean = normalizeText(text);
  if (!clean || clean.length > 140) return 0;

  const words = clean.split(/\s+/).length;
  const ratio = bodySize > 0 ? fontSize / bodySize : 1;

  if (ratio >= 1.5) return 1;
  if (ratio >= 1.25) return 2;
  if (ratio >= 1.12 && words <= 16) return 3;

  const numbered = /^(\d+(?:\.\d+)*)[.)]?\s+\S/.exec(clean);
  if (numbered && words <= 16) return Math.min(4, numbered[1].split(".").length + 1);

  const bare = clean.replace(/[.:;]+$/, "").toLowerCase();
  if (words <= 12 && SECTION_NAMES.includes(bare)) return 1;

  if (words <= 12 && clean === clean.toUpperCase() && /[A-Z]/.test(clean) && ratio >= 1.02) return 2;

  return 0;
};

/**
 * How the original text was aligned.
 *
 * Left edges that line up mean left-aligned; if every line but the last also
 * ends at the same right edge, it was justified (which the editor and the
 * exporter can both reproduce). Centred text keeps its centre and moves both
 * edges; right-aligned text keeps its right edge.
 */
const alignmentFor = (paragraph) => {
  const lefts = paragraph.lineLefts;
  const rights = paragraph.lineRights;
  const leftSpread = Math.max(...lefts) - Math.min(...lefts);
  const rightSpread = Math.max(...rights) - Math.min(...rights);

  if (leftSpread <= 1.5) {
    const widest = Math.max(...rights);
    const body = rights.slice(0, -1);
    const flushBody = body.length >= 2 && body.every((right) => Math.abs(right - widest) < 2.5);
    const lastShorter = rights.length > 1 && rights[rights.length - 1] < widest - 6;
    return flushBody && lastShorter ? "justify" : "left";
  }

  if (rightSpread <= 1.5) return "right";

  const centers = paragraph.lineLefts.map((left, index) => (left + paragraph.lineRights[index]) / 2);
  const centerSpread = Math.max(...centers) - Math.min(...centers);
  if (centerSpread <= 2.5) return "center";

  return "left";
};

/** Baseline-to-baseline spacing as a multiple of the font size. */
const lineHeightFor = (paragraph) => {
  const baselines = paragraph.baselines;
  if (!baselines || baselines.length < 2) return 1.15;

  const deltas = [];
  for (let i = 1; i < baselines.length; i += 1) {
    const diff = Math.abs(baselines[i - 1] - baselines[i]);
    if (diff > 0) deltas.push(diff);
  }
  if (!deltas.length) return 1.15;
  deltas.sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)];
  const ratio = median / (paragraph.fontSize || 1);
  return Math.min(2.0, Math.max(0.95, round(ratio)));
};

// --- figures ----------------------------------------------------------------

const resolveObject = (objects, id) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      // The callback form waits for pdfjs to decode the object; the promise form
      // throws "Requesting object that isn't resolved yet" for anything drawn
      // inside a form XObject, which is most real figures.
      objects.get(id, finish);
    } catch {
      finish(null);
    }

    // Deliberately not unref'd: an unref'd timer does not keep the event loop
    // alive, so a figure pdfjs never finishes decoding would silently stop the
    // whole extraction (node exits with an unsettled top-level await) instead of
    // being skipped.
    setTimeout(() => finish(null), OBJECT_RESOLVE_TIMEOUT_MS);
  });

const multiplyMatrix = (m1, m2) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

const boxFromMatrix = (matrix) => {
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => [
    matrix[0] * u + matrix[2] * v + matrix[4],
    matrix[1] * u + matrix[3] * v + matrix[5],
  ]);
  const xs = corners.map((corner) => corner[0]);
  const ys = corners.map((corner) => corner[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

/**
 * Every image the page paints, with the box it lands in.
 *
 * The graphics-state matrix is tracked through the operator list because that is
 * the only place the placement exists: `paintImageXObject` names the bitmap but
 * not where it goes.
 */
const collectPageFigures = async (page, viewport, ops, options = {}) => {
  const { figureCache, skipChromeBand } = options;
  const pdfjs = await loadPdfjs();
  const candidates = [];

  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];

  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === pdfjs.OPS.save) stack.push([...matrix]);
    else if (fn === pdfjs.OPS.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === pdfjs.OPS.transform) matrix = multiplyMatrix(matrix, args);
    else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintJpegXObject) {
      const id = args[0];
      if (typeof id !== "string") continue;
      const box = boxFromMatrix(matrix);
      if (box.width < MIN_FIGURE_WIDTH || box.height < MIN_FIGURE_HEIGHT) continue;

      // A picture that sits in the header/footer band of a multi-page document is
      // a letterhead, a logo or a watermark - the visual half of the running
      // chrome that is already stripped out of the text for the same reason.
      if (skipChromeBand) {
        const top = viewport.height - box.y - box.height;
        const bottom = top + box.height;
        const inBand = top <= viewport.height * HEADER_BAND_RATIO
          || bottom >= viewport.height * (1 - HEADER_BAND_RATIO);
        if (inBand) continue;
      }

      candidates.push({ id, box });
    }
  }

  const seen = new Set();
  const figures = [];

  for (const candidate of candidates) {
    const key = `${candidate.id}@${Math.round(candidate.box.x)}:${Math.round(candidate.box.y)}:${Math.round(candidate.box.width)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Decoding and re-encoding a bitmap is by far the most expensive thing this
    // service does, and the same logo or figure is often painted on many pages -
    // so an object is decoded once per document, not once per placement.
    let cached = figureCache?.get(candidate.id);
    if (cached === undefined) {
      const image = (await resolveObject(page.objs, candidate.id))
        || (await resolveObject(page.commonObjs, candidate.id));

      let dataUri = null;
      if (typeof image?.getBytes === "function") {
        // A JPEG stream is already a complete image; re-encoding it would only
        // lose quality and time.
        const bytes = image.getBytes();
        if (bytes?.length) dataUri = `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
      } else if (image && (image.width || 0) * (image.height || 0) <= MAX_FIGURE_PIXELS) {
        const png = pngFromPdfjsImage(image);
        if (png) dataUri = `data:image/png;base64,${png.toString("base64")}`;
      }

      if (dataUri && dataUri.length > MAX_FIGURE_BYTES) dataUri = null;
      cached = dataUri;
      figureCache?.set(candidate.id, cached);
    }

    if (!cached) continue;

    figures.push({
      objectId: candidate.id,
      dataUri: cached,
      // PDF measures y upwards from the bottom-left; the page reads downwards.
      y: viewport.height - candidate.box.y - candidate.box.height,
      x: candidate.box.x,
      width: candidate.box.width,
      height: candidate.box.height,
    });
  }

  return figures;
};

// --- node builders ----------------------------------------------------------

/**
 * A block of text, positioned exactly where the page had it.
 *
 * Weight and slant are carried as *marks on each run*, not as block styling:
 * that is the only way a bold heading, a bold word inside a normal paragraph and
 * an unbolded word inside a bold heading can all survive the same round trip.
 */
const blockNode = (paragraph, headingLevel, pageNumber, blockIndex, stats) => {
  const runs = paragraph.runs.filter((run) => run.text.length > 0);
  const widestRight = Math.max(...paragraph.lineRights);
  const leftmost = Math.min(...paragraph.lineLefts);
  // A little slack, proportional and absolute: the text is drawn again in a
  // font that is only metric-*compatible* with the original, and wrapping a line
  // that fitted would push text into the block below it.
  const wrapWidth = Math.max(24, round((widestRight - leftmost) * 1.01 + WRAP_SLACK_POINTS));
  const height = round(Math.max(paragraph.fontSize, paragraph.bottom - paragraph.top));
  const text = normalizeText(paragraph.text);

  if (headingLevel) stats.headings += 1;
  else stats.paragraphs += 1;
  stats.characters += text.length;

  return {
    type: "pdfBlock",
    attrs: {
      id: `p${pageNumber}-b${blockIndex}`,
      x: round(leftmost),
      y: round(paragraph.top),
      width: wrapWidth,
      height,
      fontSize: round(paragraph.fontSize),
      fontFamily: paragraph.fontFamily,
      fontName: runs.find((run) => run.fontName)?.fontName || null,
      align: alignmentFor(paragraph),
      lineHeight: lineHeightFor(paragraph),
      // The first baseline sits this far below the block's top. The browser does
      // the same with the font's own metrics; the exporter needs to be told.
      ascent: round(paragraph.ascent || 0.8, 3),
      page: pageNumber,
      heading: headingLevel || 0,
      originalText: text,
    },
    content: runs.map((run) => {
      const marks = [];
      if (run.bold) marks.push({ type: "bold" });
      if (run.italic) marks.push({ type: "italic" });
      return makeTextNode(run.text, marks);
    }),
  };
};

const figureNode = (figure, index, pageNumber) => ({
  type: "pdfFigure",
  attrs: {
    src: figure.dataUri,
    x: round(figure.x),
    y: round(figure.y),
    width: round(figure.width),
    height: round(figure.height),
    alt: `Figure ${index + 1} from page ${pageNumber}`,
    page: pageNumber,
  },
});

// --- reading ----------------------------------------------------------------

/**
 * Read a PDF file into an editable document that keeps its layout.
 *
 * @param {string} filePath
 * @returns {Promise<{ document: object, pageCount: number, warnings: string[], stats: object }>}
 */
export const readPdfStructure = async (filePath) => {
  const pdfjs = await loadPdfjs();
  const buffer = await fs.readFile(filePath);

  const warnings = [];
  const pages = [];
  const chromeCounter = new Map();

  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
      // A PDF that asks for a password is reported as unreadable rather than
      // hanging on a prompt nobody can answer.
      password: "",
    }).promise;
  } catch (error) {
    throw new Error(
      error?.name === "PasswordException"
        ? "This PDF is password-protected, so its text cannot be read into the workspace."
        : `This file could not be read as a PDF (${error.message}).`
    );
  }

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      // Painted first: the fonts (and their weights) only become resolvable once
      // the page's operators have been read.
      const ops = await page.getOperatorList();
      const textContent = await page.getTextContent();

      const fontNames = new Set(textContent.items.map((item) => item.fontName).filter(Boolean));
      const fonts = await resolveFonts(page, fontNames);

      const lines = buildLines(textContent, viewport, fonts);
      const pageTextWidth = Math.max(...lines.map((line) => line.width), 1);

      pages.push({ pageNumber, viewport, lines, pageTextWidth, ops });
    }

    // Keep all lines (including headers, footers, page numbers, and running titles)
    const sizeWeights = new Map();
    for (const page of pages) {
      for (const line of page.lines) {
        const key = Math.round(line.fontSize * 2) / 2;
        sizeWeights.set(key, (sizeWeights.get(key) || 0) + line.text.length);
      }
    }
    let bodySize = 11;
    let bestWeight = -1;
    for (const [size, weight] of sizeWeights) {
      if (weight > bestWeight) {
        bestWeight = weight;
        bodySize = size;
      }
    }

    const content = [];
    const stats = { pages: doc.numPages, paragraphs: 0, headings: 0, figures: 0, characters: 0, pagesCaptured: 0 };
    let figureCount = 0;
    let figureBytes = 0;
    let droppedFigures = 0;

    const figureCache = new Map();
    const skipChromeBand = false;

    for (const page of pages) {
      const paragraphs = buildParagraphs(orderLinesByColumn(page.lines), page.pageTextWidth);
      const figures = await collectPageFigures(
        await doc.getPage(page.pageNumber),
        page.viewport,
        page.ops,
        { figureCache, skipChromeBand },
      );

      const pageContent = [];

      for (const figure of figures) {
        if (figureCount >= MAX_FIGURES || figureBytes + figure.dataUri.length > MAX_FIGURE_TOTAL_BYTES) {
          droppedFigures += 1;
          continue;
        }

        figureCount += 1;
        figureBytes += figure.dataUri.length;
        stats.figures += 1;
        pageContent.push(figureNode(figure, figureCount, page.pageNumber));
      }

      let blockIndex = 0;
      for (const paragraph of paragraphs) {
        const text = normalizeText(paragraph.text);
        if (!text) continue;
        blockIndex += 1;
        pageContent.push(blockNode(
          paragraph,
          headingLevelFor(text, paragraph.fontSize, bodySize),
          page.pageNumber,
          blockIndex,
          stats,
        ));
      }

      const backgroundImage = null;

      content.push({
        type: "pdfPage",
        attrs: {
          width: round(page.viewport.width),
          height: round(page.viewport.height),
          page: page.pageNumber,
          backgroundImage,
        },
        // An empty page is allowed: the reader still sees a blank sheet where the
        // original had one.
        content: pageContent,
      });
      stats.pagesCaptured += 1;
    }

    const hasText = content.some((page) => (page.content || []).some((node) => node.type === "pdfBlock"));
    const isScanned = !hasText;
    if (isScanned) {
      warnings.push(
        "This PDF appears to be scanned or image-based. Text editing is not currently available for this document."
      );
    }

    if (droppedFigures > 0) {
      warnings.push(`${droppedFigures} figure${droppedFigures === 1 ? "" : "s"} were not carried over (the workspace keeps at most ${MAX_FIGURES}).`);
    }

    return {
      document: { type: "doc", content },
      pageCount: doc.numPages,
      warnings,
      isScanned,
      stats: { ...stats, bodyFontSize: bodySize },
    };
  } finally {
    await doc.destroy().catch(() => { });
  }
};

export default { readPdfStructure };

