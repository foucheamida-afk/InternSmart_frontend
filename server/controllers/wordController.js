import { docxBufferToEditorContent, editorContentToDocxBuffer, normalizeEditorContent } from "../services/docxService.js";
import { getAccess, reportFileFormat } from "./reportWorkspaceController.js";
import { DOCX_MIME } from "../utils/documentTypes.js";
import { checkStorableDocumentContent, tooLargeMessage } from "../utils/storedContentLimit.js";

/**
 * Word round trip for the writing workspace.
 *
 *   POST /api/workspace/import-word   .docx -> editor content
 *   POST /api/workspace/export-word   editor content -> .docx
 *
 * Both are deliberately separate from the older GET /reports/:id/word export,
 * which serves Word-openable HTML as .doc. That one is left in place because it
 * needs no dependency and some clients still call it; this one writes a real
 * OOXML package (and can read one back).
 */

const MAX_WARNINGS = 12;

const cleanFileName = (value) =>
  String(value || "internship-report")
    .replace(/\.[^./\\]+$/, "")
    .replace(/[^a-z0-9 _-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "internship-report";

const reportTitle = (report, fallback) => String(fallback || report?.title || "Internship Report").trim();

/**
 * POST /api/workspace/import-word
 * Multipart: `document` (the .docx), optional `reportId` to save the result.
 *
 * Without a reportId the conversion is returned for the client to load into the
 * editor (a report that has never been saved has no row to write to yet).
 */
export const importReportFromWord = async (req, res) => {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ message: "Attach a Word (.docx) document to import." });
    }

    let converted;
    try {
      converted = await docxBufferToEditorContent(req.file.buffer);
    } catch (error) {
      console.error("WORD IMPORT ERROR:", error);
      return res.status(422).json({
        message: "That file could not be read as a Word document. If it was created by an older version of Word, save it as .docx first.",
      });
    }

    const warnings = (converted.messages || []).slice(0, MAX_WARNINGS);
    const documentContent = converted.document;
    const reportId = Number(req.body?.reportId) || null;

    if (!reportId) {
      return res.json({
        message: "Word document imported into the editor.",
        documentContent,
        warnings,
        saved: false,
        reportId: null,
        file: { name: req.file.originalname, size: req.file.size ?? req.file.buffer.length },
      });
    }

    const { report, access } = await getAccess(reportId, req.user);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (!access) return res.status(403).json({ message: "You are not assigned to this report" });

    // A report uploaded as a PDF is view-only, and importing Word content into it
    // would be worse than a style problem: the archived version would still be the
    // PDF while the editable content became something else, so an approval bound
    // to the PDF's hash could end up vouching for text that came from elsewhere.
    // The supported route to an editable report is uploading the .docx itself,
    // which opens a new version and a fresh review round.
    const format = await reportFileFormat(report);
    if (!format.editable) {
      return res.status(409).json({
        message: "This report was uploaded as a PDF and is view-only. Upload the Word (.docx) document as a new report version instead of importing it here.",
        code: "REPORT_NOT_EDITABLE",
      });
    }

    if (report.lockedAt) {
      return res.status(409).json({
        message: "This report has been finalised and can no longer be replaced. Contact an administrator if a correction is required.",
        code: "REPORT_LOCKED",
      });
    }

    // Importing writes the converted document onto the report, so the same
    // single-statement ceiling applies as on upload: a Word file with images in it
    // converts to far more than its own size, and an over-sized write would be
    // answered by the database resetting the connection rather than by an error.
    const size = await checkStorableDocumentContent(documentContent);
    if (size.tooLarge) {
      return res.status(413).json({
        message: tooLargeMessage(size, { subject: "This Word document" }),
        code: "REPORT_CONTENT_TOO_LARGE",
        contentBytes: size.bytes,
        contentLimitBytes: size.limit,
      });
    }

    await report.update({ documentContent, updatedAt: new Date() });

    return res.json({
      message: "Word document imported and saved to this report.",
      documentContent,
      warnings,
      saved: true,
      reportId: report.id,
      file: { name: req.file.originalname, size: req.file.size ?? req.file.buffer.length },
    });
  } catch (error) {
    console.error("WORD IMPORT ERROR:", error);
    return res.status(500).json({ message: "Unable to import that Word document." });
  }
};

/**
 * POST /api/workspace/export-word
 * Body: { documentContent } (the live editor document) or { reportId } to use the
 * stored copy, plus an optional `title` used for the file name.
 *
 * Content first: exporting what is on screen means a document does not have to be
 * saved before it can be handed to a supervisor, and unsaved edits are included.
 */
export const exportReportAsDocx = async (req, res) => {
  try {
    const requestedTitle = String(req.body?.title || "").trim();
    let documentContent = req.body?.documentContent ?? null;
    let title = requestedTitle;

    if (!documentContent && req.body?.reportId) {
      const { report, access } = await getAccess(Number(req.body.reportId), req.user);
      if (!report) return res.status(404).json({ message: "Report not found" });
      if (!access) return res.status(403).json({ message: "You are not assigned to this report" });
      documentContent = report.documentContent;
      title = reportTitle(report, requestedTitle);
    }

    const document = normalizeEditorContent(documentContent);
    if (!document) {
      return res.status(400).json({
        message: "This report has no editable content to export yet. Write something or import a Word document first.",
      });
    }

    const header = req.body?.header ?? null;
    const footer = req.body?.footer ?? null;

    const buffer = await editorContentToDocxBuffer(document, { title, header, footer });

    res.setHeader("Content-Type", DOCX_MIME);
    res.setHeader("Content-Disposition", `attachment; filename="${cleanFileName(title)}.docx"`);
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error("WORD EXPORT ERROR:", error);
    return res.status(500).json({ message: "Unable to export this report as a Word document." });
  }
};

export default { importReportFromWord, exportReportAsDocx };
