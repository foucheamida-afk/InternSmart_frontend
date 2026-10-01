import mammoth from "mammoth";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { DOCX_EXTENSION, DOCX_MIME } from "../utils/documentTypes.js";

/**
 * Word (.docx) <-> writing-workspace conversion.
 *
 * Reading a .docx needs a real OOXML reader (mammoth); writing one needs a real
 * OOXML writer (docx). The two directions are deliberately asymmetric:
 *
 *   import : .docx -> mammoth -> semantic HTML -> ProseMirror JSON
 *   export : ProseMirror JSON -> docx object model -> .docx buffer
 *
 * The editor never sees HTML. Mammoth is used purely as an OOXML reader, and its
 * output is translated into the exact node/mark vocabulary the TipTap schema in
 * client/src/pages/WritingWorkspace.jsx understands, so imported text arrives as
 * editable content (headings stay headings, lists stay lists) rather than one
 * flat paragraph blob.
 */

export { DOCX_MIME, DOCX_EXTENSION };

/* ------------------------------------------------------------------ *
 * Small HTML helpers (no DOM available on the server, so the mammoth
 * output - which is a small, predictable subset of HTML - is tokenised
 * by hand instead of pulling in jsdom).
 * ------------------------------------------------------------------ */

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bull: "\u2022",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  deg: "\u00b0",
  times: "\u00d7",
  euro: "\u20ac",
  pound: "\u00a3",
};

const decodeEntities = (value) =>
  String(value ?? "").replace(/&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity) => {
    if (entity.startsWith("#")) {
      const code = entity[1] === "x" || entity[1] === "X"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      try {
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named === undefined ? match : named;
  });

const ATTRIBUTE_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const parseAttributes = (raw = "") => {
  const attributes = {};
  for (const match of String(raw).matchAll(ATTRIBUTE_RE)) {
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[match[1].toLowerCase()] = decodeEntities(value);
  }
  return attributes;
};

const parseStyle = (style = "") => {
  const parsed = {};
  for (const declaration of String(style).split(";")) {
    const separator = declaration.indexOf(":");
    if (separator === -1) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (property && value) parsed[property] = value;
  }
  return parsed;
};

const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/**
 * Tokenise HTML into a plain tree. Tolerant by design: an unclosed tag is closed
 * at the end, and a stray close tag is ignored rather than throwing - a malformed
 * Word document should import as much as it can, not fail the whole request.
 */
const parseHtml = (html) => {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const appendText = (raw) => {
    if (!raw) return;
    const text = decodeEntities(raw).replace(/\s+/g, " ");
    if (!text) return;
    const parent = top();
    const previous = parent.children[parent.children.length - 1];
    if (previous?.tag === "#text") previous.text += text;
    else parent.children.push({ tag: "#text", text });
  };

  const tokenRe = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/\s*([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/?)>/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRe.exec(html)) !== null) {
    if (match.index > lastIndex) appendText(html.slice(lastIndex, match.index));
    lastIndex = tokenRe.lastIndex;

    if (match[1]) {
      const name = match[1].toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === name) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    if (!match[2]) continue; // comment / CDATA
    const name = match[2].toLowerCase();
    const node = { tag: name, attrs: parseAttributes(match[3]), children: [] };
    top().children.push(node);
    if (!match[4] && !VOID_ELEMENTS.has(name)) stack.push(node);
  }

  if (lastIndex < html.length) appendText(html.slice(lastIndex));
  return root;
};

/* ------------------------------------------------------------------ *
 * HTML -> ProseMirror JSON
 * ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "hr", "div", "section", "article", "header", "footer", "main", "aside",
  "figure", "figcaption", "dl", "dt", "dd", "address", "center", "form",
  "fieldset", "details", "summary",
]);

const LIST_CONTAINER_TAGS = new Set(["ul", "ol"]);
const TABLE_SECTION_TAGS = new Set(["thead", "tbody", "tfoot"]);
const HEADING_RE = /^h([1-6])$/;

const isBlockTag = (tag) => BLOCK_TAGS.has(tag);
const isListTag = (tag) => LIST_CONTAINER_TAGS.has(tag);
const isTableSectionTag = (tag) => TABLE_SECTION_TAGS.has(tag);

/** Normalise a CSS colour to something the TipTap extensions accept. */
const toCssColor = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "transparent" || raw === "initial" || raw === "inherit") return null;
  return raw;
};

/** Marks contributed by one element, as an array (a <span> can add two). */
const marksForElement = (element) => {
  switch (element.tag) {
    case "strong":
    case "b":
      return [{ type: "bold" }];
    case "em":
    case "i":
      return [{ type: "italic" }];
    case "u":
    case "ins":
      return [{ type: "underline" }];
    case "s":
    case "strike":
    case "del":
      return [{ type: "strike" }];
    case "code":
    case "kbd":
    case "samp":
      return [{ type: "code" }];
    case "mark":
      return [{ type: "highlight", attrs: { color: "yellow" } }];
    case "a": {
      const href = element.attrs?.href;
      if (!href) return [];
      return [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow" } }];
    }
    case "span": {
      const style = parseStyle(element.attrs?.style);
      const marks = [];
      const background = toCssColor(style["background-color"]);
      if (background) marks.push({ type: "highlight", attrs: { color: background } });

      const textStyle = {};
      const color = toCssColor(style.color);
      if (color) textStyle.color = color;
      if (style["font-family"]) textStyle.fontFamily = style["font-family"].replace(/^["']|["']$/g, "");
      if (style["font-size"]) textStyle.fontSize = style["font-size"].replace(/\s+/g, "");
      if (Object.keys(textStyle).length) marks.push({ type: "textStyle", attrs: textStyle });
      return marks;
    }
    default:
      return [];
  }
};

/** Intermediate inline descriptors: { text | hardBreak | image, marks }. */
const collectInline = (element, inheritedMarks = []) => {
  const items = [];
  const ownMarks = marksForElement(element);
  const marks = ownMarks.length ? [...inheritedMarks, ...ownMarks] : inheritedMarks;

  for (const child of element.children || []) {
    if (!child.tag) continue;
    if (child.tag === "#text") {
      if (child.text) items.push({ text: child.text, marks });
      continue;
    }
    if (child.tag === "br") {
      items.push({ hardBreak: true, marks: inheritedMarks });
      continue;
    }
    if (child.tag === "img") {
      const unsupported = child.attrs?.["data-unsupported-image"];
      if (unsupported) {
        // A Word-only vector picture (EMF/WMF): the browser would show a broken
        // image, so the placeholder says what is actually there.
        const kind = String(unsupported).replace(/^image\//, "").toUpperCase();
        items.push({ text: `[figure: ${kind} image, not displayable in the browser]`, marks: inheritedMarks });
        continue;
      }
      items.push({ image: child.attrs || {}, marks: inheritedMarks });
      continue;
    }
    if (child.tag === "wbr" || child.tag === "script" || child.tag === "style") continue;
    if (VOID_ELEMENTS.has(child.tag)) continue;

    // A block element inside inline context (Word emits those now and then):
    // its inline content is kept, its block semantics are dropped.
    items.push(...collectInline(child, marks));
  }

  return items;
};

/** Drop whitespace-only edges and collapse runs of spaces inside a block. */
const normalizeInline = (items = []) => {
  const isWhitespace = (item) => item?.text !== undefined && !item.text.trim();
  const trimmed = [...items];
  while (trimmed.length && isWhitespace(trimmed[0])) trimmed.shift();
  while (trimmed.length && isWhitespace(trimmed[trimmed.length - 1])) trimmed.pop();

  const collapsed = [];
  for (const item of trimmed) {
    if (isWhitespace(item) && isWhitespace(collapsed[collapsed.length - 1])) continue;
    collapsed.push(item.text !== undefined ? { ...item, text: item.text.replace(/\s+/g, " ") } : item);
  }
  return collapsed;
};

const toInlineNodes = (items = []) =>
  items.map((item) => {
    if (item.text !== undefined) {
      const node = { type: "text", text: item.text };
      if (item.marks?.length) node.marks = item.marks;
      return node;
    }
    if (item.hardBreak) return { type: "hardBreak" };
    if (item.image) {
      const { src, alt, title, width, height } = item.image;
      const attrs = { src: src || "", alt: alt || "" };
      if (title) attrs.title = title;
      const pixels = (value) => {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
      };
      if (pixels(width)) attrs.width = pixels(width);
      if (pixels(height)) attrs.height = pixels(height);
      return { type: "image", attrs };
    }
    return null;
  }).filter(Boolean);

const paragraphNode = (items) => {
  const inline = normalizeInline(items);
  return inline.length ? { type: "paragraph", content: toInlineNodes(inline) } : { type: "paragraph" };
};

const ensureBlocks = (blocks) => (blocks.length ? blocks : [{ type: "paragraph" }]);

const plainTextOf = (element) => {
  const raw = [];
  const walk = (node) => {
    for (const child of node.children || []) {
      if (child.tag === "#text") raw.push(child.text);
      else if (child.tag === "br") raw.push("\n");
      else walk(child);
    }
  };
  walk(element);
  return raw.join("");
};

const listNode = (element) => {
  const items = [];
  for (const child of element.children || []) {
    if (child.tag !== "li") continue;
    items.push({ type: "listItem", content: ensureBlocks(listItemContent(child)) });
  }
  if (!items.length) return null;
  return {
    type: element.tag === "ol" ? "orderedList" : "bulletList",
    content: items,
  };
};

const listItemContent = (item) => {
  const blocks = [];
  let pending = [];
  const flush = () => {
    const inline = normalizeInline(pending);
    pending = [];
    if (inline.length) blocks.push({ type: "paragraph", content: toInlineNodes(inline) });
  };

  const walk = (children) => {
    for (const child of children || []) {
      if (!child.tag) continue;
      if (child.tag === "#text") {
        if (child.text) pending.push({ text: child.text, marks: [] });
        continue;
      }
      if (isListTag(child.tag)) {
        flush();
        const nested = listNode(child);
        if (nested) blocks.push(nested);
        continue;
      }
      if (child.tag === "li") {
        flush();
        blocks.push(...listItemContent(child));
        continue;
      }
      if (isBlockTag(child.tag)) {
        flush();
        blocks.push(...convertBlockElement(child));
        continue;
      }
      pending.push(...collectInline(child, []));
    }
  };

  walk(item.children);
  flush();
  return blocks;
};

const emptyCell = (type = "tableCell") => ({ type, content: [{ type: "paragraph" }] });

/**
 * Word tables routinely use merged cells (`w:gridSpan` / `w:vMerge`), and the
 * editor's basic table node has no colspan: a row whose cells do not line up with
 * the other rows renders with mismatched column widths, which reads as a broken
 * table. A span is therefore kept as one cell plus empty filler cells, and short
 * rows are padded, so every row has the same number of cells and the text lands
 * in the right column.
 */
const tableNode = (element) => {
  const rows = [];
  const collectRows = (node) => {
    for (const child of node.children || []) {
      if (!child.tag) continue;
      if (child.tag === "tr") rows.push(child);
      else if (isTableSectionTag(child.tag)) collectRows(child);
      // A nested <table> belongs to a cell and is converted when that cell is.
    }
  };
  collectRows(element);

  const grid = rows.map((row) => {
    const cells = [];
    for (const cell of row.children || []) {
      if (cell.tag !== "td" && cell.tag !== "th") continue;
      const type = cell.tag === "th" ? "tableHeader" : "tableCell";
      cells.push({
        type,
        content: ensureBlocks(convertChildrenToBlocks(cell.children)),
      });
      const span = Math.min(Math.max(Number(cell.attrs?.colspan) || 1, 1), 12);
      for (let index = 1; index < span; index += 1) cells.push(emptyCell(type));
    }
    return cells;
  }).filter((cells) => cells.length);

  const columnCount = grid.reduce((widest, cells) => Math.max(widest, cells.length), 0);
  const content = grid.map((cells) => ({
    type: "tableRow",
    content: cells.length < columnCount
      ? [...cells, ...Array.from({ length: columnCount - cells.length }, () => emptyCell())]
      : cells,
  }));

  return content.length ? { type: "table", content } : null;
};

const hasClass = (element, className) =>
  String(element?.attrs?.class || "").split(/\s+/).includes(className);

/**
 * Word alignment -> a marker style name.
 *
 * Mammoth's HTML drops paragraph alignment entirely, so a centred title, a
 * justified body and a right-aligned date all arrived as plain left-aligned text.
 * The alignment *is* in the document model that mammoth hands to
 * `transformDocument`, but the only channel from there into the HTML output is
 * the style name/id. So a marker run is wrapped around the paragraph's content,
 * the style map below turns it into `<span class="align-center">`, and this side
 * reads it back off the paragraph (see `extractAlignment`) as `textAlign` - the
 * attribute the editor's TextAlign extension actually supports.
 */
const ALIGNMENT_MARKERS = {
  center: "InternSmartAlignCenter",
  right: "InternSmartAlignRight",
  end: "InternSmartAlignRight",
  both: "InternSmartAlignJustify",
  justify: "InternSmartAlignJustify",
  distribute: "InternSmartAlignJustify",
};

const ALIGNMENT_FROM_MARKER = {
  "align-center": "center",
  "align-right": "right",
  "align-justify": "justify",
};

/**
 * Mammoth checks `run.highlight !== null`, so an omitted property would make it
 * look up a highlight path for `undefined` and wrap the paragraph in <mark>.
 * Every field the converter tests has to be present and explicitly neutral.
 */
const markerRun = (children, styleName) => ({
  type: "run",
  children,
  styleId: styleName,
  styleName,
  isBold: false,
  isUnderline: false,
  isItalic: false,
  isStrikethrough: false,
  isAllCaps: false,
  isSmallCaps: false,
  verticalAlignment: "baseline",
  font: null,
  fontSize: null,
  highlight: null,
});

/**
 * Word names its built-in heading styles in the document's language, and mammoth
 * only matches the English ones. A French report ("Titre 1", "Titre 2") therefore
 * imported with no headings at all: every chapter title arrived as body text, and
 * the outline panel came up empty. Matching the common names here and rewriting
 * them to the English style the default style map already knows is enough to get
 * the structure back, whatever language the file was authored in.
 */
const HEADING_STYLE_RE = /^(?:heading|titre|t[ií]tulo|t[ií]tol|überschrift|uberschrift|titolo|rubrik|kop|koptekst|otsikko|надзаголовок)\s*([1-6])?$/i;
const HEADING_STYLE_ID_RE = /^(?:heading|titre|titulo|überschrift|uberschrift|titolo)([1-6])$/i;

const englishHeadingStyle = (paragraph) => {
  const styleName = String(paragraph.styleName || "").trim();
  const styleId = String(paragraph.styleId || "").trim();

  const fromName = styleName.match(HEADING_STYLE_RE);
  if (fromName) return Number(fromName[1] || 1);

  const fromId = styleId.replace(/[\s_-]+/g, "").match(HEADING_STYLE_ID_RE);
  if (fromId) return Number(fromId[1]);

  return null;
};

const wordFidelityTransforms = mammoth.transforms.paragraph((paragraph) => {
  let transformed = paragraph;

  const level = englishHeadingStyle(paragraph);
  if (level) {
    transformed = { ...transformed, styleId: `Heading${level}`, styleName: `Heading ${level}` };
  }

  const marker = ALIGNMENT_MARKERS[String(paragraph.alignment || "").trim().toLowerCase()];
  if (marker) {
    transformed = { ...transformed, children: [markerRun(transformed.children || [], marker)] };
  }

  return transformed;
});

/** Unwrap the marker spans and report the alignment they carried. */
const extractAlignment = (element) => {
  let children = element.children || [];
  let alignment = null;

  for (let depth = 0; depth < 8; depth += 1) {
    if (children.length !== 1 || children[0].tag !== "span") break;
    const classes = String(children[0].attrs?.class || "").split(/\s+/).filter(Boolean);
    const marker = classes.find((name) => ALIGNMENT_FROM_MARKER[name]);
    if (!marker) break;
    alignment = ALIGNMENT_FROM_MARKER[marker];
    children = children[0].children || [];
  }

  return { alignment, children };
};

/** Paragraph content plus any alignment the marker spans carried. */
const paragraphFromElement = (element) => {
  const { alignment, children } = extractAlignment(element);
  const node = paragraphNode(collectInline({ ...element, children }, []));
  if (!alignment) return node;
  return { ...node, attrs: { ...(node.attrs || {}), textAlign: alignment } };
};

function convertBlockElement(element) {
  const heading = element.tag.match(HEADING_RE);
  if (heading) {
    const { alignment, children } = extractAlignment(element);
    const inline = normalizeInline(collectInline({ ...element, children }, []));
    const attrs = { level: Number(heading[1]) };
    if (alignment) attrs.textAlign = alignment;
    const node = { type: "heading", attrs };
    if (inline.length) node.content = toInlineNodes(inline);
    return [node];
  }

  switch (element.tag) {
    case "p": {
      // A Word page break lands here as <p><hr class="pagebreak" /></p>.
      if ((element.children || []).some((child) => child.tag === "hr" && hasClass(child, "pagebreak"))) {
        return [{ type: "pageBreak" }];
      }
      return [paragraphFromElement(element)];
    }
    case "ul":
    case "ol": {
      const list = listNode(element);
      return list ? [list] : [];
    }
    case "blockquote":
      return [{ type: "blockquote", content: ensureBlocks(convertChildrenToBlocks(element.children)) }];
    case "pre": {
      const text = plainTextOf(element).replace(/^\n+|\n+$/g, "");
      return [text ? { type: "codeBlock", content: [{ type: "text", text }] } : { type: "codeBlock" }];
    }
    case "table": {
      const table = tableNode(element);
      return table ? [table] : [];
    }
    case "hr":
      return [hasClass(element, "pagebreak") ? { type: "pageBreak" } : { type: "horizontalRule" }];
    case "dt":
    case "dd":
      return [paragraphNode(collectInline(element, []))];
    default: {
      // Transparent container (div/section/figure/...): keep the inner blocks.
      const inner = convertChildrenToBlocks(element.children);
      if (inner.length) return inner;
      const inline = normalizeInline(collectInline(element, []));
      return inline.length ? [paragraphNode(inline)] : [];
    }
  }
}

function convertChildrenToBlocks(children = []) {
  const blocks = [];
  let pending = [];

  const flush = () => {
    const inline = normalizeInline(pending);
    pending = [];
    if (inline.length) blocks.push({ type: "paragraph", content: toInlineNodes(inline) });
  };

  for (const child of children) {
    if (!child.tag) continue;
    if (child.tag === "#text") {
      if (child.text) pending.push({ text: child.text, marks: [] });
      continue;
    }
    if (isBlockTag(child.tag)) {
      flush();
      blocks.push(...convertBlockElement(child));
      continue;
    }
    pending.push(...collectInline(child, []));
  }

  flush();
  return blocks;
}

/** Semantic HTML (mammoth output) -> ProseMirror document JSON. */
export const htmlToEditorDocument = (html) => {
  const tree = parseHtml(html || "");
  const blocks = convertChildrenToBlocks(tree.children);
  return {
    type: "doc",
    content: blocks.length ? blocks : [{ type: "paragraph" }],
  };
};

/**
 * Mammoth ignores underline and highlight by default (underline is confused with
 * links in HTML), and has no mapping for a Word page break, so those three are
 * asked for explicitly. The rest of the list recovers the styles this exporter
 * writes, which is what makes an InternSmart -> Word -> InternSmart trip lossless.
 */
const MAMMOTH_STYLE_MAP = [
  "u => u",
  "highlight => mark",
  "br[type='page'] => hr.pagebreak:fresh",
  "p[style-name='Horizontal Rule'] => hr:fresh",
  "r[style-name='InternSmartAlignCenter'] => span.align-center",
  "r[style-name='InternSmartAlignRight'] => span.align-right",
  "r[style-name='InternSmartAlignJustify'] => span.align-justify",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='Block Text'] => blockquote:fresh",
  "p[style-name='Code Block'] => pre:fresh",
];

const EMU_PER_PIXEL = 9525;
// The A4 text column of the writing workspace. Anything wider is scaled down to
// fit; a picture is never scaled up past the size Word gave it.
const MAX_IMAGE_WIDTH_PX = 620;

const hashBytes = (bytes) => createHash("sha1").update(bytes).digest("hex");

/** Formats the editor and the exporter can actually carry. */
const SUPPORTED_IMAGE_TYPES = /^image\/(png|jpe?g|gif|bmp|webp|svg\+xml)$/i;

/**
 * Word records every picture's display size (<wp:extent>, in EMU) but mammoth's
 * HTML does not carry it, so an imported figure arrived at its *intrinsic* pixel
 * size - a 3000px screenshot scaled to 400px in Word filled the whole column.
 *
 * The extent is not exposed through mammoth's image element, so it is read from
 * the package here: every drawing's extent precedes its image reference, and the
 * reference resolves through the document relationships to a media file. Keying
 * the result by the image bytes means the lookup cannot drift out of order, which
 * is what an index-based pairing would do as soon as a footnote or a header
 * contributes a picture of its own.
 */
const readImageSizes = async (buffer) => {
  const sizes = new Map();
  const zip = await JSZip.loadAsync(buffer);

  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) return sizes;

  const relationships = await zip.file("word/_rels/document.xml.rels")?.async("string") || "";
  const targets = new Map();
  for (const match of relationships.matchAll(/<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) {
    targets.set(match[1], match[2]);
  }

  const tokenRe = /<wp:extent[^>]*?cx="(\d+)"[^>]*?cy="(\d+)"|<a:blip[^>]*?r:embed="([^"]+)"|<v:imagedata[^>]*?r:id="([^"]+)"/g;
  const placements = [];
  let extent = null;

  for (const match of documentXml.matchAll(tokenRe)) {
    if (match[1] !== undefined) {
      extent = {
        width: Math.round(Number(match[1]) / EMU_PER_PIXEL),
        height: Math.round(Number(match[2]) / EMU_PER_PIXEL),
      };
      continue;
    }
    const relationshipId = match[3] || match[4];
    if (relationshipId && extent?.width > 0) placements.push({ relationshipId, ...extent });
  }

  for (const placement of placements) {
    const target = targets.get(placement.relationshipId);
    if (!target) continue;
    const path = target.startsWith("/") ? target.slice(1) : `word/${target.replace(/^\.\//, "")}`;
    const file = zip.file(path);
    if (!file) continue;
    try {
      const key = hashBytes(await file.async("nodebuffer"));
      if (!sizes.has(key)) sizes.set(key, { width: placement.width, height: placement.height });
    } catch {
      // A media part that cannot be read just means no stored size for it.
    }
  }

  return sizes;
};

const scaleImageSize = ({ width, height }) => {
  if (!width || !height) return null;
  if (width <= MAX_IMAGE_WIDTH_PX) return { width, height };
  const ratio = MAX_IMAGE_WIDTH_PX / width;
  return { width: MAX_IMAGE_WIDTH_PX, height: Math.max(1, Math.round(height * ratio)) };
};

/**
 * .docx bytes -> editor content.
 * Returns { document, messages, text } where `messages` are mammoth's warnings
 * (unsupported styles, dropped images, ...) so the UI can be honest about what
 * did not survive the trip.
 */
export const docxBufferToEditorContent = async (buffer) => {
  if (!buffer || !buffer.length) throw new Error("The uploaded Word file is empty.");

  const imageSizes = await readImageSizes(buffer).catch((error) => {
    console.warn("DOCX IMAGE SIZE ERROR:", error.message);
    return new Map();
  });

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: MAMMOTH_STYLE_MAP,
      // Paragraph alignment is dropped by mammoth's HTML, so it is carried
      // through the document model and reattached as `textAlign` (see
      // wordFidelityTransforms).
      transformDocument: wordFidelityTransforms,
      // Empty paragraphs are meaningful here: a page break and a horizontal rule
      // are both carried by a paragraph that has no text of its own, and
      // mammoth's default (true) discards them before the style map can see them.
      ignoreEmptyParagraphs: false,
      // Inline the pictures as data URIs: a Word file is the only source for
      // its images, and a data URI is the one form the editor can render and
      // the exporter can embed again without any file hosting.
      convertImage: mammoth.images.imgElement(async (image) => {
        // EMF/WMF are Word-only vector formats: the browser renders them as a
        // broken image, so the importer leaves a labelled placeholder instead.
        if (!SUPPORTED_IMAGE_TYPES.test(image.contentType || "")) {
          return { "data-unsupported-image": image.contentType || "unknown" };
        }

        const base64 = await image.read("base64");
        const attributes = { src: `data:${image.contentType};base64,${base64}` };
        const size = scaleImageSize(imageSizes.get(hashBytes(Buffer.from(base64, "base64"))) || {});
        if (size) {
          // mammoth's HTML writer escapes attribute values as strings.
          attributes.width = String(size.width);
          attributes.height = String(size.height);
        }
        return attributes;
      }),
    },
  );

  const document = htmlToEditorDocument(result.value);
  const messages = (result.messages || [])
    .map((message) => message?.message)
    .filter(Boolean);

  return { document, messages };
};

/** .docx bytes -> flattened plain text (used where only text is needed, e.g. AI review). */
export const docxBufferToPlainText = async (buffer) => {
  if (!buffer || !buffer.length) throw new Error("The uploaded Word file is empty.");
  const result = await mammoth.extractRawText({ buffer });
  return String(result.value || "").replace(/\n{3,}/g, "\n\n").trim();
};

/* ------------------------------------------------------------------ *
 * ProseMirror JSON -> .docx
 * ------------------------------------------------------------------ */

const ALIGNMENTS = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const HEADINGS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

const COLOR_NAMES = {
  yellow: "FFFF00",
  red: "FF0000",
  green: "00B050",
  blue: "0070C0",
  black: "000000",
  white: "FFFFFF",
  orange: "FFA500",
  purple: "800080",
  gray: "808080",
  grey: "808080",
};

const hexFromRgb = (match) =>
  [1, 2, 3]
    .map((index) => Math.max(0, Math.min(255, Math.round(Number(match[index])))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

/** Any CSS colour -> the 6-digit hex OOXML wants (undefined when unknowable). */
export const toHexColor = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return undefined;

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const body = hex[1];
    return (body.length === 3 ? body.split("").map((character) => character + character).join("") : body).toUpperCase();
  }

  const rgb = raw.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) return hexFromRgb(rgb);

  return COLOR_NAMES[raw];
};

/** "14px" / "12pt" / "1.15em" -> half-points, the unit docx uses for run size. */
const toHalfPoints = (value) => {
  const match = String(value ?? "").trim().match(/^([\d.]+)\s*(px|pt|em|rem)?$/i);
  if (!match) return undefined;
  const size = Number(match[1]);
  if (!Number.isFinite(size) || size <= 0) return undefined;

  const unit = (match[2] || "px").toLowerCase();
  const points = unit === "pt"
    ? size
    : unit === "px"
      ? size * 0.75 // CSS reference pixel: 96px = 72pt
      : size * 12;  // em/rem are relative to the 12pt document default

  return Math.max(2, Math.round(points * 2));
};

/** "margin-left: 48px" (the indent extension) -> twips. */
const indentFromStyle = (style) => {
  const match = String(style ?? "").match(/margin-left:\s*(\d+(?:\.\d+)?)px/i);
  if (!match) return undefined;
  const pixels = Number(match[1]);
  if (!Number.isFinite(pixels) || pixels <= 0) return undefined;
  return Math.round(pixels * 15); // 96px = 1in = 1440 twips
};

const withoutUndefined = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const imageRunFrom = (attrs = {}) => {
  const src = String(attrs.src || "");
  const dataUrl = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,([\s\S]+)$/i);
  // Remote images are deliberately skipped: embedding them would mean the
  // export endpoint fetching arbitrary URLs on behalf of the caller (SSRF).
  if (!dataUrl) return null;

  const extension = dataUrl[1].toLowerCase();
  const type = extension === "jpeg" ? "jpg" : extension;

  try {
    const image = new ImageRun({
      type,
      data: Buffer.from(dataUrl[2], "base64"),
      transformation: {
        width: Math.max(24, Math.round(Number(attrs.width) || 450)),
        height: Math.max(24, Math.round(Number(attrs.height) || 300)),
      },
      altText: { title: attrs.alt || "Image", description: attrs.alt || "", name: attrs.alt || "image" },
    });
    return image;
  } catch {
    return null;
  }
};

const textRunFrom = (node, baseOptions = {}) => {
  // `link` is a runsFor marker (it decides the hyperlink wrapper), not a docx
  // run option - docx has no run-level link property.
  const { link: isLink, ...runOptions } = baseOptions;
  const marks = node.marks || [];
  const mark = (name) => marks.find((entry) => entry.type === name);
  const textStyle = mark("textStyle")?.attrs || {};
  const highlight = mark("highlight");
  const code = mark("code");

  // Only ever set these when they apply. Writing bold:false explicitly would
  // override the Heading/Quote style Word resolves from the paragraph style,
  // which silently un-bolded every heading in an exported document.
  return new TextRun(withoutUndefined({
    ...runOptions,
    text: node.text ?? "",
    bold: runOptions.bold || mark("bold") ? true : undefined,
    italics: runOptions.italics || mark("italic") ? true : undefined,
    underline: mark("underline") || isLink ? {} : undefined,
    strike: mark("strike") ? true : undefined,
    color: toHexColor(textStyle.color) || (isLink ? "0563C1" : undefined),
    size: toHalfPoints(textStyle.fontSize),
    font: textStyle.fontFamily || (code ? "Consolas" : undefined),
    ...highlightRunOptions(highlight),
  }));
};

/** Word only understands a fixed set of highlight colours; anything else is shading. */
const highlightRunOptions = (highlight) => {
  if (!highlight) return {};
  const hex = toHexColor(highlight.attrs?.color);
  const named = {
    FFFF00: "yellow",
    "00FF00": "green",
    "00FFFF": "cyan",
    FF00FF: "magenta",
    "0000FF": "blue",
    FF0000: "red",
    "000000": "black",
  }[hex];
  if (named) return { highlight: named };
  return { shading: { fill: hex || "FFFF00" } };
};

const runsFor = (nodes = [], baseOptions = {}) => {
  const runs = [];
  for (const node of nodes || []) {
    if (!node) continue;
    if (node.type === "text") {
      const href = (node.marks || []).find((mark) => mark.type === "link")?.attrs?.href;
      if (href) {
        runs.push(new ExternalHyperlink({
          children: [textRunFrom(node, { ...baseOptions, link: true })],
          link: href,
        }));
      } else {
        runs.push(textRunFrom(node, baseOptions));
      }
      continue;
    }
    if (node.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
      continue;
    }
    if (node.type === "image") {
      const image = imageRunFrom(node.attrs);
      if (image) runs.push(image);
      continue;
    }
    if (node.type === "pageBreak") {
      runs.push(new PageBreak());
      continue;
    }
    if (Array.isArray(node.content)) runs.push(...runsFor(node.content, baseOptions));
  }
  return runs;
};

const paragraphProperties = (node, context = {}) => {
  const alignment = ALIGNMENTS[node.attrs?.textAlign];
  const indent = indentFromStyle(node.attrs?.style);
  const quoteDepth = context.quoteDepth || 0;

  return withoutUndefined({
    alignment,
    // The Quote style carries its own indent, so only deeper nesting is added.
    indent: quoteDepth > 1 ? { left: (indent || 0) + (quoteDepth - 1) * 720 } : indent ? { left: indent } : undefined,
    style: context.quote ? "Quote" : undefined,
  });
};

const listParagraphOptions = (kind, level) =>
  kind === "number"
    ? { numbering: { reference: "internsmart-ordered", level: Math.min(level, 8) } }
    : { bullet: { level: Math.min(level, 8) } };

const LIST_LEVELS = Array.from({ length: 9 }, (_, level) => ({
  level,
  format: LevelFormat.DECIMAL,
  text: `%${level + 1}.`,
  alignment: AlignmentType.START,
  style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
}));

function listItemParagraphs(item, kind, level, out) {
  const blocks = item?.content || [];
  const first = blocks[0];
  const isTextBlock = Boolean(first && (first.type === "paragraph" || first.type === "heading"));
  const remainder = isTextBlock ? blocks.slice(1) : blocks;

  if (isTextBlock) {
    out.push(new Paragraph({
      ...paragraphProperties(first),
      ...listParagraphOptions(kind, level),
      children: runsFor(first.content),
    }));
  } else {
    // A list item whose first block is a nested list: keep the marker so the
    // bullet is not lost, then emit the real content underneath it.
    out.push(new Paragraph({ ...listParagraphOptions(kind, level) }));
  }

  // Word has no "list inside a list" node: a nested list becomes the next
  // indentation level of the same list, which is what Word itself produces.
  for (const child of remainder) {
    if (child?.type === "bulletList") {
      for (const nestedItem of child.content || []) listItemParagraphs(nestedItem, "bullet", level + 1, out);
      continue;
    }
    if (child?.type === "orderedList") {
      for (const nestedItem of child.content || []) listItemParagraphs(nestedItem, "number", level + 1, out);
      continue;
    }
    blockToDocx(child, {}, out);
  }
  return out;
}

const tableToDocx = (node) => {
  const rows = (node.content || []).map((row) => new TableRow({
    children: (row.content || []).map((cell) => {
      const isHeader = cell.type === "tableHeader";
      const blocks = (cell.content || []).length ? cell.content : [{ type: "paragraph" }];
      const children = [];
      for (const block of blocks) blockToDocx(block, { forceBold: isHeader }, children);
      if (!children.length) children.push(new Paragraph(""));
      return new TableCell({
        children,
        shading: isHeader ? { fill: "F2F2F2" } : undefined,
      });
    }),
  }));

  if (!rows.length) return null;
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
};

function blockToDocx(node, context, out) {
  if (!node) return out;

  switch (node.type) {
    case "doc":
    case "listItem":
    case "tableRow":
    case "tableCell":
    case "tableHeader": {
      for (const child of node.content || []) blockToDocx(child, context, out);
      return out;
    }

    case "paragraph": {
      out.push(new Paragraph({
        ...paragraphProperties(node, context),
        children: runsFor(node.content, context.forceBold ? { bold: true } : {}),
      }));
      return out;
    }

    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      out.push(new Paragraph({
        ...paragraphProperties(node, context),
        heading: HEADINGS[level],
        children: runsFor(node.content, context.forceBold ? { bold: true } : {}),
      }));
      return out;
    }

    case "bulletList":
    case "orderedList": {
      const kind = node.type === "orderedList" ? "number" : "bullet";
      const level = context.listLevel || 0;
      for (const item of node.content || []) listItemParagraphs(item, kind, level, out);
      return out;
    }

    case "blockquote": {
      // A real Word paragraph style (not just indentation) so the quote survives
      // a trip back through mammoth, which matches on style names.
      const quoteContext = { ...context, quote: true, quoteDepth: (context.quoteDepth || 0) + 1 };
      for (const child of node.content || []) blockToDocx(child, quoteContext, out);
      return out;
    }

    case "codeBlock": {
      const text = (node.content || []).map((child) => child.text || "").join("");
      out.push(new Paragraph({
        style: "Code Block",
        shading: { fill: "F5F5F5" },
        spacing: { before: 120, after: 120 },
        children: [new TextRun({ text, font: "Consolas", size: 20 })],
      }));
      return out;
    }

    case "horizontalRule": {
      out.push(new Paragraph({
        style: "Horizontal Rule",
        spacing: { before: 120, after: 120 },
      }));
      return out;
    }

    case "pageBreak": {
      out.push(new Paragraph({ children: [new PageBreak()] }));
      return out;
    }

    case "table": {
      const table = tableToDocx(node);
      if (table) out.push(table);
      return out;
    }

    case "image": {
      const image = imageRunFrom(node.attrs);
      if (image) out.push(new Paragraph({ children: [image] }));
      return out;
    }

    case "hardBreak": {
      out.push(new Paragraph({ children: [new TextRun({ break: 1 })] }));
      return out;
    }

    default: {
      if (Array.isArray(node.content)) {
        for (const child of node.content) blockToDocx(child, context, out);
      } else if (typeof node.text === "string") {
        out.push(new Paragraph({ children: [new TextRun({ text: node.text })] }));
      }
      return out;
    }
  }
}

/** Accepts ProseMirror JSON, a JSON string, or plain text. */
export const normalizeEditorContent = (value) => {
  if (value && typeof value === "object" && value.type === "doc") return value;

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") return normalizeEditorContent(parsed);
      } catch {
        // fall through to the plain-text interpretation
      }
    }
    return {
      type: "doc",
      content: trimmed.split(/\n\s*\n/).filter(Boolean).map((paragraph) => ({
        type: "paragraph",
        content: [{ type: "text", text: paragraph.trim() }],
      })),
    };
  }

  return null;
};

/** Editor content -> .docx bytes. */
export const editorContentToDocxBuffer = async (value, { title, header, footer } = {}) => {
  const document = normalizeEditorContent(value);
  if (!document) throw new Error("There is no editor content to export.");

  // Extract header/footer config from document JSON if present
  const headerConfig = header || document.headerConfig || {};
  const footerConfig = footer || document.footerConfig || {};

  const children = [];
  blockToDocx(document, {}, children);
  if (!children.length) children.push(new Paragraph(""));

  const docHeaders = {};
  if (headerConfig.enabled && headerConfig.text) {
    const alignment = ALIGNMENTS[headerConfig.alignment] || AlignmentType.CENTER;
    docHeaders.default = new Header({
      children: [
        new Paragraph({
          alignment,
          children: [
            new TextRun({
              text: headerConfig.text,
              font: headerConfig.fontFamily || "Times New Roman",
              size: toHalfPoints(headerConfig.fontSize) || 18,
              italics: Boolean(headerConfig.italic),
              bold: Boolean(headerConfig.bold),
              color: "666666",
            }),
          ],
          border: headerConfig.showSeparator
            ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } }
            : undefined,
        }),
      ],
    });
  }

  const docFooters = {};
  if (footerConfig.enabled) {
    const alignment = ALIGNMENTS[footerConfig.alignment] || AlignmentType.RIGHT;
    const footerRuns = [];
    if (footerConfig.text) {
      footerRuns.push(
        new TextRun({
          text: `${footerConfig.text}   `,
          font: footerConfig.fontFamily || "Times New Roman",
          size: toHalfPoints(footerConfig.fontSize) || 18,
          italics: Boolean(footerConfig.italic),
          bold: Boolean(footerConfig.bold),
          color: "666666",
        })
      );
    }

    if (footerConfig.pageNumbering?.enabled) {
      footerRuns.push(
        new TextRun({ text: "Page ", font: "Times New Roman", size: 18, color: "666666" }),
        PageNumber.CURRENT,
        new TextRun({ text: " of ", font: "Times New Roman", size: 18, color: "666666" }),
        PageNumber.TOTAL_PAGES
      );
    }

    if (footerRuns.length) {
      docFooters.default = new Footer({
        children: [
          new Paragraph({
            alignment,
            children: footerRuns,
            border: footerConfig.showSeparator
              ? { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } }
              : undefined,
          }),
        ],
      });
    }
  }

  const doc = new Document({
    creator: "InternSmart",
    title: title || "Internship Report",
    description: "Exported from the InternSmart writing workspace",
    numbering: { config: [{ reference: "internsmart-ordered", levels: LIST_LEVELS }] },
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 }, // 12pt
          paragraph: { spacing: { line: 360, after: 120 } }, // 1.5 line spacing
        },
      },
      paragraphStyles: [
        {
          id: "Quote",
          name: "Quote",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { italics: true },
          paragraph: { indent: { left: 720 }, spacing: { before: 120, after: 120 } },
        },
        {
          id: "Code Block",
          name: "Code Block",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Consolas", size: 20 },
          paragraph: { spacing: { before: 120, after: 120 } },
        },
        {
          id: "Horizontal Rule",
          name: "Horizontal Rule",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 2 },
          paragraph: {
            spacing: { before: 120, after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        headers: docHeaders,
        footers: docFooters,
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
};
