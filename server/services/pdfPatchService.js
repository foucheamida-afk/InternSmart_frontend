import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs/promises";

/**
 * Patch an existing PDF file on disk by replacing modified text blocks at their
 * exact locations while preserving all unchanged pages and visual elements.
 *
 * @param {string} filePath  absolute path to the PDF on disk
 * @param {Array<object>} changes list of changed text blocks
 * @returns {Promise<{ success: boolean, savedAt: string, count: number }>}
 */
export const patchPdf = async (filePath, changes = []) => {
  if (!Array.isArray(changes) || changes.length === 0) {
    return { success: true, savedAt: new Date().toISOString(), count: 0 };
  }

  const existingBuffer = await fs.readFile(filePath);
  const pdfDoc = await PDFDocument.load(existingBuffer, { ignoreEncryption: true });

  const fontCache = new Map();
  const getFont = async (fontFamily, isBold, isItalic) => {
    const key = `${fontFamily}:${Boolean(isBold)}:${Boolean(isItalic)}`;
    if (fontCache.has(key)) return fontCache.get(key);

    let fontStandard = StandardFonts.Helvetica;
    const isMono = fontFamily === "monospace" || /courier/i.test(fontFamily || "");
    const isSerif = fontFamily === "serif" || /times/i.test(fontFamily || "");

    if (isMono) {
      if (isBold && isItalic) fontStandard = StandardFonts.CourierBoldOblique;
      else if (isBold) fontStandard = StandardFonts.CourierBold;
      else if (isItalic) fontStandard = StandardFonts.CourierOblique;
      else fontStandard = StandardFonts.Courier;
    } else if (isSerif) {
      if (isBold && isItalic) fontStandard = StandardFonts.TimesRomanBoldItalic;
      else if (isBold) fontStandard = StandardFonts.TimesRomanBold;
      else if (isItalic) fontStandard = StandardFonts.TimesRomanItalic;
      else fontStandard = StandardFonts.TimesRoman;
    } else {
      if (isBold && isItalic) fontStandard = StandardFonts.HelveticaBoldOblique;
      else if (isBold) fontStandard = StandardFonts.HelveticaBold;
      else if (isItalic) fontStandard = StandardFonts.HelveticaOblique;
      else fontStandard = StandardFonts.Helvetica;
    }

    const embeddedFont = await pdfDoc.embedFont(fontStandard);
    fontCache.set(key, embeddedFont);
    return embeddedFont;
  };

  const totalPages = pdfDoc.getPageCount();
  let appliedChanges = 0;

  for (const change of changes) {
    const pageNum = Number(change.page) || 1;
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= totalPages) continue;

    const page = pdfDoc.getPage(pageIndex);
    const pageHeight = page.getHeight();

    const x = Number(change.x) || 0;
    const y = Number(change.y) || 0;
    const width = Math.max(10, Number(change.width) || 100);
    const height = Math.max(Number(change.fontSize) || 10, Number(change.height) || 20);
    const fontSize = Math.max(6, Math.min(120, Number(change.fontSize) || 11));
    const ascent = Number(change.ascent) || 0.8;
    const lineHeightRatio = Number(change.lineHeight) || 1.15;
    const text = String(change.currentText || "").trim();

    // PDF coordinate system origin is bottom-left (y grows upwards)
    const pdfY = pageHeight - y - height;

    // 1. Erase/cover original text region with pure white rectangle
    page.drawRectangle({
      x: Math.max(0, x - 1),
      y: Math.max(0, pdfY - 1),
      width: width + 2,
      height: height + 2,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });

    if (!text) {
      appliedChanges += 1;
      continue;
    }

    // 2. Choose font and render replacement text
    const font = await getFont(change.fontFamily, change.bold, change.italic);

    // Split multi-line text if present
    const lines = text.split("\n");
    let currentY = pdfY + height - (fontSize * ascent);

    for (const line of lines) {
      if (currentY < 0) break;
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      let textX = x;

      if (change.align === "center") {
        textX = x + Math.max(0, (width - textWidth) / 2);
      } else if (change.align === "right") {
        textX = x + Math.max(0, width - textWidth);
      }

      page.drawText(line, {
        x: textX,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      currentY -= fontSize * lineHeightRatio;
    }

    appliedChanges += 1;
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);

  return {
    success: true,
    savedAt: new Date().toISOString(),
    count: appliedChanges,
  };
};

export default { patchPdf };
