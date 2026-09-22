import fs from "fs";
import { extractTextFromPDF } from "../services/pdfService.js";
import extractPdfText, { buildFallbackDocument } from "./extractPdfText.js";
import { docxBufferToEditorContent, docxBufferToPlainText } from "../services/docxService.js";
import { isDocxPath } from "./documentTypes.js";

export { buildFallbackDocument };

/**
 * Report files are either PDF or Word now, so every consumer has to dispatch on
 * the file type instead of assuming PDF:
 *
 *   extractDocumentContent -> editor JSON (the workspace, the upload route)
 *   extractPlainText       -> flat text   (the AI review paths)
 *
 * Both fall back to the original PDF implementations and keep their contract:
 * they return null / throw rather than propagating an unreadable file upward.
 */

export const extractDocumentContent = async (filePath) => {
  if (isDocxPath(filePath)) {
    try {
      const { document } = await docxBufferToEditorContent(fs.readFileSync(filePath));
      return document;
    } catch (error) {
      console.error("DOCX TEXT EXTRACTION ERROR:", error);
      return null;
    }
  }

  return extractPdfText(filePath);
};

export const extractPlainText = async (filePath) => {
  const buffer = fs.readFileSync(filePath);

  if (isDocxPath(filePath)) {
    const text = await docxBufferToPlainText(buffer);
    if (!text) throw new Error("No readable text was found in the Word document.");
    return { text };
  }

  return extractTextFromPDF(buffer);
};

// Node types that carry no report content on their own. Anything else - an image,
// a table, a list - counts as content even when it holds no text.
const CONTENTLESS_NODE_TYPES = new Set(["doc", "paragraph", "heading", "text", "hardBreak", "pageBreak"]);

const holdsContent = (node) => {
  if (!node || typeof node !== "object") return false;
  if (typeof node.text === "string" && node.text.trim()) return true;
  if (node.type && !CONTENTLESS_NODE_TYPES.has(node.type)) return true;
  return Array.isArray(node.content) ? node.content.some(holdsContent) : false;
};

/**
 * Did the converter come back with nothing?
 *
 * An empty conversion is not an error: `htmlToEditorDocument("")` returns a
 * document holding one empty paragraph, which looks exactly like a valid result.
 * That is how a report ended up permanently empty - the converter produced
 * nothing for a real 5.5 MB thesis (one empty paragraph, 74 bytes), the result
 * was stored as the finished document, and every later load saw "content is
 * already there" and never looked at the file again. The file was fine; only the
 * conversion had failed.
 *
 * So "contentless" is treated as "not converted yet" and the file is read again,
 * which also means a report converted by an older, buggier converter heals
 * itself instead of staying broken forever.
 *
 * The cost of that rule is that a student who deliberately deletes every word
 * would have the text re-read from their own uploaded file on the next load.
 * That is the safer failure: the content is restored from the file they
 * submitted, never invented, and a report cannot be lost to a silent no-op.
 */
export const isContentlessDocument = (documentContent) => {
  let document = documentContent;
  if (typeof document === "string") {
    try {
      document = JSON.parse(document);
    } catch {
      return true;
    }
  }
  if (!document || typeof document !== "object") return true;
  return !holdsContent(document);
};

export default extractDocumentContent;
