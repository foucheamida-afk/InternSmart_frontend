import fs from "fs";
import { PDFParse } from "pdf-parse";

const extractPdfText = async (filePath) => {
  let parser = null;
  try {
    const buffer = fs.readFileSync(filePath);
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = String(result.text || "").trim();
    if (!text) return null;
    const paragraphs = text
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!paragraphs.length) return null;
    return {
      type: "doc",
      content: paragraphs.map((paragraph) => ({
        type: "paragraph",
        content: [{ type: "text", text: paragraph }],
      })),
    };
  } catch (error) {
    console.error("PDF TEXT EXTRACTION ERROR:", error);
    return null;
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
};

export const buildFallbackDocument = (fileName = "Uploaded report") => ({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: fileName }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "The document content could not be extracted from the uploaded file. You can start typing or paste your report content here." }],
    },
  ],
});

export default extractPdfText;
