import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import jwt from "jsonwebtoken";

import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import ReportComment from "../models/reportCommentModel.js";
import User from "../models/userModel.js";
import { getAccess, reportFileFormat } from "./reportWorkspaceController.js";
import { REPORT_FILE_KIND, PDF_MIME } from "../utils/documentTypes.js";
import { absolutePathFor } from "../utils/uploadPath.js";
import hashFile from "../utils/fileHash.js";
import { readPdfStructure } from "../services/pdfStructureService.js";

/**
 * The PDF workshop: a PDF report opened for viewing *and* collaboration.
 *
 * The rule that shapes every endpoint here is that the PDF is not document
 * content the application owns - it is a file. So:
 *
 *   - nothing is written to `Reports.documentContent` for a PDF. Only the name
 *     and the location of the file are ever stored, exactly as before.
 *   - the editable structure (paragraphs, headings, figures) is *derived* from
 *     the file on demand and lives in the collaboration session, not in a column.
 *   - saving writes the regenerated PDF straight back over the file, so the
 *     document the workspace displays is always the document the server holds.
 *
 * The structure is cached in this process, keyed by the file's identity (name,
 * size, mtime). That makes reopening a 136-page report instant while keeping the
 * cache honest: a file that changed on disk is re-read.
 */

// --- structure cache --------------------------------------------------------

/**
 * The layout version of the extracted structure.
 *
 * It is part of the collaboration document's name, which is what keeps a change
 * to the way a PDF is interpreted from being invisible: an in-memory session
 * seeded by an older build stays where it is, and the next session under a new
 * version number starts from the file again instead of reusing a structure this
 * build no longer produces.
 */
export const PDF_LAYOUT_VERSION = 6;

const STRUCTURE_CACHE_LIMIT = 6;
const structureCache = new Map(); // absolutePath -> { identity, value }

const fileIdentity = async (absolutePath) => {
  const stats = await fsp.stat(absolutePath);
  return `v${PDF_LAYOUT_VERSION}:${stats.size}:${Math.round(stats.mtimeMs)}`;
};

const cachedStructure = async (absolutePath) => {
  const identity = await fileIdentity(absolutePath);
  const hit = structureCache.get(absolutePath);
  if (hit && hit.identity === identity) {
    // Re-insert so the Map's insertion order stays least-recently-used first.
    structureCache.delete(absolutePath);
    structureCache.set(absolutePath, hit);
    return hit.value;
  }
  return null;
};

const rememberStructure = (absolutePath, identity, value) => {
  structureCache.set(absolutePath, { identity, value });
  while (structureCache.size > STRUCTURE_CACHE_LIMIT) {
    structureCache.delete(structureCache.keys().next().value);
  }
};

export const forgetPdfStructure = (absolutePath) => structureCache.delete(absolutePath);

// --- shared helpers ---------------------------------------------------------

/** The file a PDF report points at: its absolute path and its published URL. */
const pdfFileFor = async (report) => {
  const version = report.currentVersionId
    ? await ReportVersion.findByPk(report.currentVersionId, { attributes: ["id", "fileUrl"] })
    : null;
  const fileUrl = version?.fileUrl || report.fileUrl;
  const absolutePath = absolutePathFor(fileUrl);

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return { absolutePath: null, fileUrl };
  }
  return { absolutePath, fileUrl };
};

const outlineFromStructure = (documentContent) => {
  const items = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "heading") {
      const text = (node.content || []).map((child) => child.text || "").join("").trim();
      if (text) {
        items.push({
          id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
          label: text,
          level: Math.min(4, Number(node.attrs?.level) || 1),
        });
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(documentContent);
  return items;
};

const commentsFor = (reportId) =>
  ReportComment.findAll({
    where: { reportId },
    include: [{ model: User, as: "author", attributes: ["id", "name", "role"] }],
    order: [["createdAt", "ASC"]],
  });

/**
 * Is this report a PDF, and may this caller write to it?
 *
 * `editable` is kept distinct from `canWrite` for the same reason the Word
 * workspace separates them: "this file cannot be edited here" and "you are not
 * the one who may edit it" need different explanations in the UI.
 */
const resolvePdfReport = async (req) => {
  const { report, access } = await getAccess(req.params.id, req.user);
  if (!report) return { error: { status: 404, message: "Report not found" } };
  if (!access) return { error: { status: 403, message: "You are not assigned to this report" } };

  const format = await reportFileFormat(report);
  if (format.fileType !== REPORT_FILE_KIND.PDF) {
    return {
      report,
      format,
      // The Word workspace owns .docx reports; saying so is more useful than a
      // blanket refusal.
      error: {
        status: 409,
        message: "This report is a Word document. Open it in the writing workspace instead.",
        code: "REPORT_NOT_PDF",
      },
    };
  }

  return { report, format };
};

// --- GET /api/workspace/reports/:id/pdf -------------------------------------

export const getPdfWorkspace = async (req, res) => {
  try {
    const { report, error } = await resolvePdfReport(req);
    if (error) return res.status(error.status).json({ message: error.message, code: error.code });

    const { absolutePath, fileUrl } = await pdfFileFor(report);

    if (!absolutePath) {
      return res.status(404).json({
        message: "The PDF file for this report is no longer on the server, so it cannot be opened. Upload the report again to restore it.",
        code: "REPORT_FILE_MISSING",
      });
    }

    const identity = await fileIdentity(absolutePath);
    let extracted = await cachedStructure(absolutePath);

    if (!extracted) {
      try {
        extracted = await readPdfStructure(absolutePath);
        rememberStructure(absolutePath, identity, extracted);
      } catch (extractionError) {
        // A PDF whose text cannot be read is still a PDF: the file is shown as it
        // is, and the editable side says why it is empty rather than failing the
        // whole request.
        console.error("PDF STRUCTURE EXTRACTION ERROR:", extractionError);
        extracted = {
          document: { type: "doc", content: [{ type: "paragraph" }] },
          pageCount: null,
          stats: null,
          warnings: [
            extractionError.message
            || "The text of this PDF could not be read, so the editable side is empty. The file itself is shown unchanged.",
          ],
        };
      }
    }

    const { document: structure, pageCount, warnings, stats } = extracted;
    const comments = await commentsFor(report.id);
    // A finalised report is read-only for everyone, not just for supervisors: the
    // archived bytes were hashed for approval, so the author may no longer change
    // them either.
    const locked = Boolean(report.lockedAt);
    const readOnly = req.user.role !== "student" || locked;

    return res.json({
      report: {
        id: report.id,
        title: report.title,
        status: report.status,
        updatedAt: report.updatedAt,
        fileName: report.fileName,
        fileType: REPORT_FILE_KIND.PDF,
        locked: Boolean(report.lockedAt),
      },
      // `editable` describes the file, `canWrite` the caller. A PDF is editable
      // here - that is the point of this workspace - but only by its author, and
      // never once the report has been finalised.
      editable: true,
      canWrite: !readOnly,
      readOnly,
      locked,
      fileUrl,
      fileRevision: identity,
      structure,
      pageCount,
      stats,
      warnings,
      sections: outlineFromStructure(structure),
      comments,
      // The collaboration session name. Clients join this to edit the same
      // document; it carries no data itself. The version suffix is explained at
      // PDF_LAYOUT_VERSION.
      collaborationDocument: `report-pdf-${report.id}-v${PDF_LAYOUT_VERSION}`,
    });
  } catch (error) {
    console.error("GET PDF WORKSPACE ERROR:", error);
    return res.status(500).json({ message: "Unable to open this PDF report." });
  }
};

// --- GET /api/workspace/reports/:id/pdf/file --------------------------------
//
// Serves the file itself, which is what the workspace displays.
//
// The token is accepted from the query string as well as the header because this
// URL is loaded by an <iframe>, and a browser will not attach an Authorization
// header to a frame navigation. Query-string credentials are a compromise and
// they are treated as one: only this read-only endpoint accepts them, the URL is
// never logged, and the response is `no-store`.

export const authenticatePdfFileRequest = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const token = bearer || req.query.token;

    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose) return res.status(401).json({ message: "Invalid or expired token" });

    const user = await User.findByPk(decoded.id, { attributes: ["id", "active", "role", "onboardingCompletedAt"] });
    if (!user || user.active === false) {
      return res.status(403).json({ message: "This account has been deactivated. Please contact your administrator." });
    }

    req.user = {
      ...decoded,
      role: user.role,
      onboardingCompletedAt: user.onboardingCompletedAt,
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const getPdfFile = async (req, res) => {
  try {
    const { report, error } = await resolvePdfReport(req);
    if (error) return res.status(error.status).json({ message: error.message, code: error.code });

    const { absolutePath } = await pdfFileFor(report);
    if (!absolutePath) {
      return res.status(404).json({ message: "The PDF file for this report is no longer on the server." });
    }

    const stats = await fsp.stat(absolutePath);
    const revision = `${stats.size}:${Math.round(stats.mtimeMs)}`;

    res.setHeader("Content-Type", PDF_MIME);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(report.fileName || "report.pdf")}"`);
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    res.setHeader("ETag", `"${revision}"`);

    if (req.headers["if-none-match"] === `"${revision}"`) return res.status(304).end();

    return fs.createReadStream(absolutePath).pipe(res);
  } catch (error) {
    console.error("GET PDF FILE ERROR:", error);
    return res.status(500).json({ message: "Unable to read the PDF file." });
  }
};

// --- PUT /api/workspace/reports/:id/pdf/file --------------------------------
//
// The save. The body is the regenerated PDF itself (raw bytes, `application/pdf`),
// and it replaces the file the report points at. Nothing about the document goes
// to the database - only the report's `updatedAt` and the archived version's hash
// and size move, because those describe the file that is now on disk.

const PDF_MAGIC = Buffer.from("%PDF-");
const MIN_PDF_BYTES = 800;

export const savePdfFile = async (req, res) => {
  try {
    const { report, error } = await resolvePdfReport(req);
    if (error) return res.status(error.status).json({ message: error.message, code: error.code });

    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only the student who wrote this report can edit it. Supervisors can read the live document and leave comments." });
    }

    if (report.lockedAt) {
      return res.status(409).json({
        message: "This report has been finalised, so its file can no longer be changed. Contact an administrator if a correction is required.",
        code: "REPORT_LOCKED",
      });
    }

    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buffer?.length) {
      return res.status(400).json({ message: "The request did not carry a PDF. Send the regenerated document as the raw request body." });
    }

    const looksLikePdf = buffer.length >= MIN_PDF_BYTES && buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
    if (!looksLikePdf) {
      return res.status(422).json({
        message: "Those bytes are not a PDF, so the stored file was left untouched.",
        code: "NOT_A_PDF",
      });
    }

    const { absolutePath } = await pdfFileFor(report);
    if (!absolutePath) {
      return res.status(404).json({ message: "The PDF file for this report is no longer on the server, so there is nothing to replace." });
    }

    // Written beside the original and renamed over it. A half-written PDF is
    // worse than a failed save: the viewer would show a corrupt document and the
    // previous version would be gone.
    const temporaryPath = `${absolutePath}.saving-${process.pid}`;
    await fsp.writeFile(temporaryPath, buffer);
    try {
      await fsp.rename(temporaryPath, absolutePath);
    } catch (renameError) {
      await fsp.rm(temporaryPath, { force: true });
      throw renameError;
    }

    forgetPdfStructure(absolutePath);

    const stats = await fsp.stat(absolutePath);
    const revision = `${stats.size}:${Math.round(stats.mtimeMs)}`;
    const fileHash = await hashFile(absolutePath);

    // The archived version describes the bytes that are on disk, so they are kept
    // in step. The version number does not change: editing a PDF rewrites it,
    // and manufacturing a new version row would claim a new upload happened.
    if (report.currentVersionId) {
      await ReportVersion.update(
        { fileHash, fileSize: buffer.length },
        { where: { id: report.currentVersionId } }
      ).catch((versionError) => {
        console.warn(`PDF SAVE: could not update version ${report.currentVersionId} metadata: ${versionError.message}`);
      });
    }

    await report.update({ updatedAt: new Date() });

    return res.json({
      message: "Saved to the PDF file.",
      fileName: report.fileName,
      bytes: buffer.length,
      fileHash,
      fileRevision: revision,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SAVE PDF FILE ERROR:", error);
    return res.status(500).json({ message: "Unable to save your changes to the PDF file." });
  }
};

export const patchPdfWorkspace = async (req, res) => {
  try {
    const { report, error } = await resolvePdfReport(req);
    if (error) return res.status(error.status).json({ message: error.message, code: error.code });

    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only the student author can edit this report." });
    }

    if (report.lockedAt) {
      return res.status(423).json({ message: "This report has been finalised, so its PDF file can no longer be changed." });
    }

    const { absolutePath } = await pdfFileFor(report);
    if (!absolutePath) {
      return res.status(404).json({ message: "The PDF file for this report is missing from the server.", code: "REPORT_FILE_MISSING" });
    }

    const { changes } = req.body || {};
    if (!Array.isArray(changes)) {
      return res.status(400).json({ message: "Invalid patch request: changes must be an array." });
    }

    // Filter out unchanged blocks
    const filtered = changes.filter(
      (c) => c && typeof c.originalText === "string" && typeof c.currentText === "string" && c.originalText.trim() !== c.currentText.trim()
    );

    if (filtered.length === 0) {
      const stats = await fsp.stat(absolutePath);
      return res.json({
        message: "No text changes detected to save.",
        fileName: report.fileName,
        fileRevision: `${stats.size}:${Math.round(stats.mtimeMs)}`,
        savedAt: new Date().toISOString(),
        count: 0,
      });
    }

    // Apply patch to original PDF file on disk using pdf-lib
    const { patchPdf } = await import("../services/pdfPatchService.js");
    const result = await patchPdf(absolutePath, filtered);

    forgetPdfStructure(absolutePath);

    const stats = await fsp.stat(absolutePath);
    const revision = `${stats.size}:${Math.round(stats.mtimeMs)}`;
    const fileHash = await hashFile(absolutePath);

    if (report.currentVersionId) {
      await ReportVersion.update(
        { fileHash, fileSize: stats.size },
        { where: { id: report.currentVersionId } }
      ).catch((vErr) => console.warn("PDF PATCH VERSION WARN:", vErr.message));
    }

    await report.update({ updatedAt: new Date() });

    return res.json({
      message: `Successfully patched ${result.count} block(s) in the PDF report.`,
      fileName: report.fileName,
      bytes: stats.size,
      fileHash,
      fileRevision: revision,
      savedAt: result.savedAt,
      count: result.count,
    });
  } catch (error) {
    console.error("PATCH PDF WORKSPACE ERROR:", error);
    return res.status(500).json({ message: error.message || "Unable to patch the PDF file." });
  }
};

export default {
  getPdfWorkspace,
  getPdfFile,
  savePdfFile,
  patchPdfWorkspace,
  authenticatePdfFileRequest,
  forgetPdfStructure,
};
