import fs from "fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Non-destructive PDF synthesis service using pdf-lib.
 *
 * Preserves original PDF background graphics and pages 100% intact while rendering
 * overlay text, annotations, images, headers, footers, and page numbers over pages.
 */
export const patchPdf = async (filePath, changes = [], options = {}) => {
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

  // 1. Process block edits / overlay changes
  if (Array.isArray(changes) && changes.length > 0) {
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

      const pdfY = pageHeight - y - height;

      // Only cover original box if explicitly requested for an edited block
      if (change.eraseOriginal) {
        page.drawRectangle({
          x: Math.max(0, x - 1),
          y: Math.max(0, pdfY - 1),
          width: width + 2,
          height: height + 2,
          color: rgb(1, 1, 1),
          borderWidth: 0,
        });
      }

      if (!text) {
        appliedChanges += 1;
        continue;
      }

      const font = await getFont(change.fontFamily, change.bold, change.italic);
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
  }

  // 2. Render Headers & Footers across pages
  const { header, footer } = options || {};

  for (let i = 0; i < totalPages; i += 1) {
    const pageNum = i + 1;
    const page = pdfDoc.getPage(i);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    // Check "different first page" configuration
    const isFirstPage = pageNum === 1;

    // --- Header ---
    if (header && header.enabled && (!isFirstPage || !header.differentFirstPage)) {
      const hFontSize = Math.max(8, Number(header.fontSize) || 9);
      const hFont = await getFont(header.fontFamily || "sans-serif", header.bold, header.italic);
      const hText = String(header.text || "").trim();
      const topMargin = Number(header.topMargin) || 25;
      const hY = pageHeight - topMargin;

      if (hText) {
        const textWidth = hFont.widthOfTextAtSize(hText, hFontSize);
        let hX = 36; // Default left margin (0.5 inch)
        if (header.alignment === "center") {
          hX = (pageWidth - textWidth) / 2;
        } else if (header.alignment === "right") {
          hX = pageWidth - 36 - textWidth;
        }

        page.drawText(hText, {
          x: hX,
          y: hY,
          size: hFontSize,
          font: hFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      if (header.showSeparator) {
        page.drawLine({
          start: { x: 36, y: hY - 6 },
          end: { x: pageWidth - 36, y: hY - 6 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      }
    }

    // --- Footer & Page Numbers ---
    if (footer && footer.enabled && (!isFirstPage || !footer.differentFirstPage)) {
      const fFontSize = Math.max(8, Number(footer.fontSize) || 9);
      const fFont = await getFont(footer.fontFamily || "sans-serif", footer.bold, footer.italic);
      const bottomMargin = Number(footer.bottomMargin) || 25;
      const fY = bottomMargin;

      let fText = String(footer.text || "").trim();

      // Resolve dynamic page number syntax
      if (footer.pageNumbering && footer.pageNumbering.enabled) {
        const pageStr = String(pageNum);
        const totalStr = String(totalPages);
        const pageNumText = (footer.pageNumbering.format || "Page {page} of {total}")
          .replace("{page}", pageStr)
          .replace("{total}", totalStr);

        fText = fText ? `${fText}  |  ${pageNumText}` : pageNumText;
      }

      if (footer.showSeparator) {
        page.drawLine({
          start: { x: 36, y: fY + 14 },
          end: { x: pageWidth - 36, y: fY + 14 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      }

      if (fText) {
        const textWidth = fFont.widthOfTextAtSize(fText, fFontSize);
        let fX = 36;
        if (footer.alignment === "center") {
          fX = (pageWidth - textWidth) / 2;
        } else if (footer.alignment === "right") {
          fX = pageWidth - 36 - textWidth;
        }

        page.drawText(fText, {
          x: fX,
          y: fY,
          size: fFontSize,
          font: fFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);

  return {
    success: true,
    savedAt: new Date().toISOString(),
    count: appliedChanges,
  };
};

/**
 * Synthesize overlay elements (Text, Image, Highlight, Header/Footer) onto a COPY of
 * the original PDF document. The original PDF file on disk is left 100% untouched.
 *
 * @param {string} filePath - Absolute path to original PDF file on disk
 * @param {Object|Array} overlayData - Object containing elements array & options
 * @param {Object} [options] - Additional options (header, footer)
 * @returns {Promise<Uint8Array>} - The synthesized PDF bytes
 */
export const synthesizePdfOverlay = async (filePath, overlayData = {}, options = {}) => {
  const existingBuffer = await fs.readFile(filePath);
  const sourceDoc = await PDFDocument.load(existingBuffer, { ignoreEncryption: true });

  const fontCache = new Map();
  const getFont = async (pdfDocTarget, fontFamily, isBold, isItalic) => {
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

    const embeddedFont = await pdfDocTarget.embedFont(fontStandard);
    fontCache.set(key, embeddedFont);
    return embeddedFont;
  };

  const parseHexColor = (hex, defaultColor = { r: 0, g: 0, b: 0 }) => {
    if (!hex || typeof hex !== "string") return rgb(defaultColor.r, defaultColor.g, defaultColor.b);
    const cleaned = hex.replace("#", "").trim();
    if (cleaned.length === 3) {
      const r = parseInt(cleaned[0] + cleaned[0], 16) / 255;
      const g = parseInt(cleaned[1] + cleaned[1], 16) / 255;
      const b = parseInt(cleaned[2] + cleaned[2], 16) / 255;
      return rgb(Number.isNaN(r) ? 0 : r, Number.isNaN(g) ? 0 : g, Number.isNaN(b) ? 0 : b);
    }
    if (cleaned.length === 6) {
      const r = parseInt(cleaned.slice(0, 2), 16) / 255;
      const g = parseInt(cleaned.slice(2, 4), 16) / 255;
      const b = parseInt(cleaned.slice(4, 6), 16) / 255;
      return rgb(Number.isNaN(r) ? 0 : r, Number.isNaN(g) ? 0 : g, Number.isNaN(b) ? 0 : b);
    }
    return rgb(defaultColor.r, defaultColor.g, defaultColor.b);
  };

  // 1. Handle Page Reordering / Deletions / Additions if specified
  let pdfDoc = sourceDoc;
  const pageOrder = overlayData?.pageOrder;
  if (Array.isArray(pageOrder) && pageOrder.length > 0) {
    const newDoc = await PDFDocument.create();
    const sourceCount = sourceDoc.getPageCount();
    for (const item of pageOrder) {
      if (item === 'new_blank_page') {
        newDoc.addPage([595.28, 841.89]);
      } else {
        const pageIdx = Number(item) - 1;
        if (pageIdx >= 0 && pageIdx < sourceCount) {
          const [copiedPage] = await newDoc.copyPages(sourceDoc, [pageIdx]);
          newDoc.addPage(copiedPage);
        }
      }
    }
    pdfDoc = newDoc;
  }

  const totalPages = pdfDoc.getPageCount();
  const elements = Array.isArray(overlayData)
    ? overlayData
    : Array.isArray(overlayData?.elements)
      ? overlayData.elements
      : [];
  const deletedElements = Array.isArray(overlayData?.deletedElements) ? overlayData.deletedElements : [];

  // 2. Erase Original Bounding Boxes for Deleted Elements
  for (const deletedItem of deletedElements) {
    if (!deletedItem) continue;
    const pageNum = Number(deletedItem.page) || 1;
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= totalPages) continue;

    const page = pdfDoc.getPage(pageIndex);
    const pageHeight = page.getHeight();
    const eraseX = Math.max(0, (Number(deletedItem.origX ?? deletedItem.x) || 0) - 1);
    const eraseY = Math.max(0, (Number(deletedItem.origY ?? deletedItem.y) || 0) - 1);
    const eraseW = Math.max(5, (Number(deletedItem.origWidth ?? deletedItem.width) || 50) + 2);
    const eraseH = Math.max(5, (Number(deletedItem.origHeight ?? deletedItem.height) || 15) + 2);
    const pdfY = pageHeight - eraseY - eraseH;

    page.drawRectangle({
      x: eraseX,
      y: Math.max(0, pdfY),
      width: eraseW,
      height: eraseH,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });
  }

  // 3. Process Active Overlay Elements (Text, Image, Highlight)
  for (const elem of elements) {
    if (!elem || elem.isDeleted) continue;
    const pageNum = Number(elem.page) || 1;
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= totalPages) continue;

    const page = pdfDoc.getPage(pageIndex);
    const pageHeight = page.getHeight();

    const x = Number(elem.x) || 0;
    const y = Number(elem.y) || 0;
    const width = Number(elem.width) || 100;
    const height = Number(elem.height) || 30;

    // Convert top-left Y (screen/overlay) to pdf-lib bottom-left Y
    const pdfY = pageHeight - y - height;

    // If an original element was modified or moved, erase its original position on the page first
    if (elem.isOriginal && (elem.origX !== undefined || elem.textChanged || elem.moved)) {
      const origX = Math.max(0, (Number(elem.origX ?? elem.x) || 0) - 1);
      const origY = Math.max(0, (Number(elem.origY ?? elem.y) || 0) - 1);
      const origW = Math.max(5, (Number(elem.origWidth ?? elem.width) || 50) + 2);
      const origH = Math.max(5, (Number(elem.origHeight ?? elem.height) || 15) + 2);
      const origPdfY = pageHeight - origY - origH;

      page.drawRectangle({
        x: origX,
        y: Math.max(0, origPdfY),
        width: origW,
        height: origH,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });
    }

    if (elem.type === "highlight") {
      const color = parseHexColor(elem.color || "#ffeb3b", { r: 1, g: 0.92, b: 0.23 });
      const opacity = typeof elem.opacity === "number" ? elem.opacity : 0.35;
      page.drawRectangle({
        x,
        y: Math.max(0, pdfY),
        width,
        height,
        color,
        opacity,
      });
    } else if (elem.type === "image" && elem.src) {
      try {
        let image;
        if (elem.src.startsWith("data:image/png;base64,")) {
          const base64Data = elem.src.replace(/^data:image\/png;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          image = await pdfDoc.embedPng(buffer);
        } else if (elem.src.startsWith("data:image/jpeg;base64,") || elem.src.startsWith("data:image/jpg;base64,")) {
          const base64Data = elem.src.replace(/^data:image\/j(peg|pg);base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          image = await pdfDoc.embedJpg(buffer);
        }
        if (image) {
          page.drawImage(image, {
            x,
            y: Math.max(0, pdfY),
            width,
            height,
          });
        }
      } catch (imgError) {
        console.warn("Failed to embed overlay image:", imgError.message);
      }
    } else if (elem.type === "text" || !elem.type) {
      const text = String(elem.text || elem.currentText || "").trim();

      // Draw background rectangle if specified or if element is original and text changed
      const shouldDrawBg = (elem.bgColor && elem.bgColor !== "transparent") || (elem.isOriginal && elem.textChanged);
      if (shouldDrawBg) {
        const bgRgb = parseHexColor(elem.bgColor || "#ffffff", { r: 1, g: 1, b: 1 });
        page.drawRectangle({
          x,
          y: Math.max(0, pdfY),
          width,
          height,
          color: bgRgb,
          borderWidth: 0,
        });
      }

      if (!text) continue;

      const fontSize = Math.max(6, Math.min(120, Number(elem.fontSize) || 12));
      const font = await getFont(pdfDoc, elem.fontFamily, elem.bold, elem.italic);
      const color = parseHexColor(elem.color || "#000000", { r: 0, g: 0, b: 0 });
      const lines = text.split("\n");
      const lineHeight = fontSize * (Number(elem.lineHeight) || 1.2);
      let currentY = pdfY + height - (fontSize * (Number(elem.ascent) || 0.8));

      for (const line of lines) {
        if (currentY < 0) break;
        const textWidth = font.widthOfTextAtSize(line, fontSize);
        let textX = x;

        if (elem.alignment === "center" || elem.align === "center") {
          textX = x + Math.max(0, (width - textWidth) / 2);
        } else if (elem.alignment === "right" || elem.align === "right") {
          textX = x + Math.max(0, width - textWidth);
        }

        page.drawText(line, {
          x: textX,
          y: Math.max(0, currentY),
          size: fontSize,
          font,
          color,
        });

        currentY -= lineHeight;
      }
    }
  }

  // 4. Render Headers & Footers
  const header = overlayData?.header || options?.header;
  const footer = overlayData?.footer || options?.footer;

  for (let i = 0; i < totalPages; i += 1) {
    const pageNum = i + 1;
    const page = pdfDoc.getPage(i);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const isFirstPage = pageNum === 1;

    if (header && header.enabled && (!isFirstPage || !header.differentFirstPage)) {
      const hFontSize = Math.max(8, Number(header.fontSize) || 9);
      const hFont = await getFont(pdfDoc, header.fontFamily || "sans-serif", header.bold, header.italic);
      const hText = String(header.text || "").trim();
      const topMargin = Number(header.topMargin) || 25;
      const hY = pageHeight - topMargin;

      if (hText) {
        const textWidth = hFont.widthOfTextAtSize(hText, hFontSize);
        let hX = 36;
        if (header.alignment === "center") hX = (pageWidth - textWidth) / 2;
        else if (header.alignment === "right") hX = pageWidth - 36 - textWidth;

        page.drawText(hText, {
          x: hX,
          y: hY,
          size: hFontSize,
          font: hFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      if (header.showSeparator) {
        page.drawLine({
          start: { x: 36, y: hY - 6 },
          end: { x: pageWidth - 36, y: hY - 6 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      }
    }

    if (footer && footer.enabled && (!isFirstPage || !footer.differentFirstPage)) {
      const fFontSize = Math.max(8, Number(footer.fontSize) || 9);
      const fFont = await getFont(pdfDoc, footer.fontFamily || "sans-serif", footer.bold, footer.italic);
      const bottomMargin = Number(footer.bottomMargin) || 25;
      const fY = bottomMargin;

      let fText = String(footer.text || "").trim();
      if (footer.pageNumbering && footer.pageNumbering.enabled) {
        const pageStr = String(pageNum);
        const totalStr = String(totalPages);
        const pageNumText = (footer.pageNumbering.format || "Page {page} of {total}")
          .replace("{page}", pageStr)
          .replace("{total}", totalStr);
        fText = fText ? `${fText}  |  ${pageNumText}` : pageNumText;
      }

      if (footer.showSeparator) {
        page.drawLine({
          start: { x: 36, y: fY + 14 },
          end: { x: pageWidth - 36, y: fY + 14 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      }

      if (fText) {
        const textWidth = fFont.widthOfTextAtSize(fText, fFontSize);
        let fX = 36;
        if (footer.alignment === "center") fX = (pageWidth - textWidth) / 2;
        else if (footer.alignment === "right") fX = pageWidth - 36 - textWidth;

        page.drawText(fText, {
          x: fX,
          y: fY,
          size: fFontSize,
          font: fFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      }
    }
  }

  return await pdfDoc.save();
};

export default { patchPdf, synthesizePdfOverlay };
