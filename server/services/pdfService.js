import { PDFParse } from "pdf-parse";

export async function extractTextFromPDF(pdfBuffer) {
  let parser = null;
  try {
    if (!pdfBuffer) {
      throw new Error("PDF buffer is missing.");
    }

    parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    const text = result.text?.trim();

    if (!text) {
      throw new Error("No readable text was found in the PDF.");
    }

    return {
      text,
      pages: result.total,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error("Failed to extract text from the PDF.");
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}