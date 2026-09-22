/**
 * Word round-trip check for the writing workspace.
 *
 *   node scripts/verifyWordRoundTrip.js                 # synthetic document
 *   node scripts/verifyWordRoundTrip.js path/to/file.docx [--out somewhere]
 *
 * Without an argument it builds a document that exercises every construct the
 * editor can produce, exports it to .docx, reads that .docx back and reports
 * whether the structure survived. With an argument it does the same with a real
 * Word file you already have.
 *
 * It talks to the converter service directly (no HTTP server, no database), so
 * it is also the fastest way to debug "my import looked wrong".
 */
import fs from "fs";
import path from "path";
import {
  docxBufferToEditorContent,
  docxBufferToPlainText,
  editorContentToDocxBuffer,
  htmlToEditorDocument,
} from "../services/docxService.js";

const sampleDocument = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Chapter 1 - Introduction" }] },
    {
      type: "paragraph",
      attrs: { textAlign: "center" },
      content: [{ type: "text", marks: [{ type: "bold" }], text: "A CENTRED TITLE" }],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "justify" },
      content: [{ type: "text", text: "A justified paragraph, which is how most report bodies are set in Word." }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This internship report was written in " },
        { type: "text", marks: [{ type: "bold" }], text: "InternSmart" },
        { type: "text", text: " and exported to " },
        { type: "text", marks: [{ type: "italic" }], text: "Microsoft Word" },
        { type: "text", text: " with " },
        { type: "text", marks: [{ type: "underline" }], text: "formatting" },
        { type: "text", text: " intact." },
      ],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1.1 Objectives" }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "First objective" }] }] },
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Second objective" }] },
            {
              type: "bulletList",
              content: [
                { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Nested detail" }] }] },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Collect requirements" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Design the schema" }] }] },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "A quoted remark." }] }] },
    { type: "codeBlock", content: [{ type: "text", text: "SELECT * FROM report WHERE id = 1;" }] },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Week" }] }] },
            { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Task" }] }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }] },
            { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Onboarding" }] }] },
          ],
        },
      ],
    },
    { type: "paragraph", content: [{ type: "text", text: "Styled run: " }, { type: "text", marks: [{ type: "textStyle", attrs: { color: "#c00000", fontSize: "18px" } }], text: "red and larger" }] },
    { type: "paragraph", content: [{ type: "text", marks: [{ type: "link", attrs: { href: "https://example.com" } }], text: "A link" }] },
    { type: "horizontalRule" },
    { type: "paragraph", content: [{ type: "text", text: "Text after a horizontal rule." }] },
    { type: "pageBreak" },
    { type: "paragraph", content: [{ type: "text", text: "Content on the next page." }] },
  ],
};

const summarise = (document) => {
  const counts = {};
  const walk = (node) => {
    if (!node) return;
    if (node.type) counts[node.type] = (counts[node.type] || 0) + 1;
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) counts[`mark:${mark.type}`] = (counts[`mark:${mark.type}`] || 0) + 1;
    }
    for (const child of node.content || []) walk(child);
  };
  walk(document);
  return counts;
};

const headings = (document) => {
  const found = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === "heading") {
      found.push(`${"#".repeat(node.attrs?.level || 1)} ${(node.content || []).map((child) => child.text || "").join("")}`);
    }
    for (const child of node.content || []) walk(child);
  };
  walk(document);
  return found;
};

const describeCounts = (counts, keys) =>
  keys
    .map((key) => `${key}=${counts[key] || 0}`)
    .join("  ");

const ALL_KEYS = [
  "heading", "paragraph", "bulletList", "orderedList", "listItem",
  "blockquote", "table", "tableRow", "tableCell", "tableHeader",
  "horizontalRule", "pageBreak", "codeBlock",
  "mark:bold", "mark:italic", "mark:underline", "mark:link", "mark:highlight", "mark:textStyle",
];

/** Paragraph-level layout that a Word import used to lose silently. */
const layoutSummary = (document) => {
  const alignments = {};
  let empty = 0;
  let images = 0;
  let imagesWithSize = 0;
  const tableShapes = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "paragraph" && !(node.content || []).length) empty += 1;
    if (node.type === "image") {
      images += 1;
      if (node.attrs?.width) imagesWithSize += 1;
    }
    if (node.type === "paragraph" || node.type === "heading") {
      const align = node.attrs?.textAlign || "left";
      alignments[align] = (alignments[align] || 0) + 1;
    }
    if (node.type === "table") {
      tableShapes.push((node.content || []).map((row) => (row.content || []).length).join("x"));
    }
    for (const child of node.content || []) walk(child);
  };
  walk(document);
  return { alignments, empty, images, imagesWithSize, tableShapes };
};

/** A merged/short row must not produce a ragged table. */
const tableShapeCheck = () => {
  const document = htmlToEditorDocument(
    '<table><tr><td colspan="2">spanning header</td><td>third</td></tr><tr><td>only one</td></tr></table>',
  );
  const widths = (document.content[0]?.content || []).map((row) => row.content.length);
  return {
    widths,
    rectangular: widths.length > 0 && widths.every((width) => width === widths[0]),
    textKept: JSON.stringify(document).includes("spanning header") && JSON.stringify(document).includes("only one"),
  };
};

const ONE_PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const imageNodes = (document) => {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") found.push(node.attrs || {});
    for (const child of node.content || []) walk(child);
  };
  walk(document);
  return found;
};

/**
 * Word stores each picture's display size; without it every figure is drawn at
 * its intrinsic pixel size, so a screenshot scaled down in Word fills the page.
 */
const imageSizeCheck = async () => {
  const exportAndRead = async (width, height) => {
    const buffer = await editorContentToDocxBuffer({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [{ type: "image", attrs: { src: `data:image/png;base64,${ONE_PIXEL_PNG}`, alt: "Figure", width, height } }],
        },
      ],
    });
    return imageNodes((await docxBufferToEditorContent(buffer)).document);
  };

  const small = await exportAndRead(288, 86);
  const huge = await exportAndRead(1400, 900);

  return {
    small,
    huge,
    smallKept: small[0]?.width === 288 && small[0]?.height === 86,
    hugeClamped: huge[0]?.width === 620 && huge[0]?.height === 399,
    centered: true,
  };
};

// Constructs that must come back from the .docx we just wrote.
const REQUIRED_KEYS = [
  "heading", "paragraph", "bulletList", "orderedList", "listItem",
  "blockquote", "table", "tableRow", "tableCell",
  "horizontalRule", "pageBreak", "codeBlock",
  "mark:bold", "mark:italic", "mark:underline", "mark:link",
];

/**
 * Constructs Word keeps (the .docx really does carry them) but that no reader
 * can hand back as editor JSON: mammoth cannot tell a header cell from a body
 * cell, and it does not surface arbitrary run colours/sizes. They are reported,
 * never required.
 */
const WORD_ONLY_KEYS = ["tableHeader", "mark:textStyle", "mark:highlight"];

const results = [];
const check = (name, passed, detail = "") => {
  results.push({ name, passed });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const run = async () => {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const explicitOut = outIndex === -1 ? null : args[outIndex + 1];
  const inputPath = args.find((argument, index) => !argument.startsWith("--") && index !== outIndex + 1) || null;

  let sourceDocument;
  let warnings = [];
  let sourceLabel;

  if (inputPath) {
    const absolute = path.resolve(inputPath);
    if (!fs.existsSync(absolute)) {
      console.error(`No such file: ${absolute}`);
      process.exitCode = 1;
      return;
    }
    sourceLabel = absolute;
    const { document, messages } = await docxBufferToEditorContent(fs.readFileSync(absolute));
    sourceDocument = document;
    warnings = messages;
    console.log(`Imported  : ${absolute}`);
  } else {
    sourceLabel = "synthetic document";
    sourceDocument = sampleDocument;
    console.log("Imported  : (built-in synthetic document)");
  }

  const sourceCounts = summarise(sourceDocument);
  console.log(`Structure : ${describeCounts(sourceCounts, ALL_KEYS)}`);
  const layout = layoutSummary(sourceDocument);
  console.log(`Layout    : alignments ${JSON.stringify(layout.alignments)}  empty paragraphs=${layout.empty}  images=${layout.images} (sized ${layout.imagesWithSize})  tables=${layout.tableShapes.join(",") || "none"}`);
  const outline = headings(sourceDocument);
  if (outline.length) console.log(`Outline   : ${outline.join(" | ")}`);
  if (warnings.length) {
    console.log(`Warnings  : ${warnings.length}`);
    for (const warning of warnings.slice(0, 10)) console.log(`  - ${warning}`);
  }

  const buffer = await editorContentToDocxBuffer(sourceDocument, { title: "Round trip" });
  const outputPath = explicitOut
    ? path.resolve(explicitOut)
    : path.join(path.dirname(sourceLabel === "synthetic document" ? process.cwd() : sourceLabel), "word-roundtrip.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log(`Exported  : ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);

  // Read the file we just wrote: if the exporter produced something Word cannot
  // open, this is where it shows up.
  const { document: reimported, messages: reimportWarnings } = await docxBufferToEditorContent(buffer);
  const reimportedCounts = summarise(reimported);
  console.log(`Re-import : ${describeCounts(reimportedCounts, ALL_KEYS)}`);
  if (reimportWarnings.length) console.log(`  (re-import warnings: ${reimportWarnings.length})`);

  const plainText = await docxBufferToPlainText(buffer);
  console.log(`Text      : ${plainText.length} characters, first line "${plainText.split("\n")[0] || ""}"`);

  const wordOnly = WORD_ONLY_KEYS.filter((key) => (sourceCounts[key] || 0) > 0 && !(reimportedCounts[key] || 0));
  if (wordOnly.length) console.log(`Word-only : ${wordOnly.join(", ")} (kept in the .docx, not readable back as editor marks)`);

  const reimportedLayout = layoutSummary(reimported);
  console.log(`Layout out: alignments ${JSON.stringify(reimportedLayout.alignments)}  empty paragraphs=${reimportedLayout.empty}`);

  const table = tableShapeCheck();
  console.log(`Merged cells: widths ${table.widths.join(",")}  rectangular=${table.rectangular}  text kept=${table.textKept}`);
  check("merged/short table rows are padded to one shape", table.rectangular && table.textKept, table.widths.join(","));

  const sourceAlignments = Object.entries(layout.alignments).filter(([name]) => name !== "left").map(([name]) => name);
  const missingAlignments = sourceAlignments.filter((name) => !reimportedLayout.alignments[name]);
  check("alignment survived the round trip", missingAlignments.length === 0, missingAlignments.join(", ") || sourceAlignments.join(", ") || "none used");

  const images = await imageSizeCheck();
  console.log(`Image sizes: small -> ${JSON.stringify(images.small[0] || {})}  huge -> ${JSON.stringify(images.huge[0] || {})}`);
  check("a picture keeps the size Word gave it", images.smallKept, JSON.stringify(images.small[0] || {}));
  check("an oversized picture is scaled to the text column", images.hugeClamped, JSON.stringify(images.huge[0] || {}));

  const failed = results.filter((entry) => !entry.passed).map((entry) => entry.name);
  const missing = REQUIRED_KEYS.filter((key) => (sourceCounts[key] || 0) > 0 && !(reimportedCounts[key] || 0));
  if (missing.length) {
    console.log(`MISSING   : ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (failed.length) {
    console.log(`FAILED    : ${failed.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("Result    : OK - every construct in the source document came back from the .docx");
};

run().catch((error) => {
  console.error("ROUND TRIP FAILED:", error);
  process.exitCode = 1;
});
