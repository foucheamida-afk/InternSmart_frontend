import Report from "../models/reportModel.js";
import ReportComment from "../models/reportCommentModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import Internship from "../models/studentAssignmentModel.js";
import { extractDocumentContent, buildFallbackDocument, isContentlessDocument } from "../utils/documentExtraction.js";
import { REPORT_FILE_KIND, reportFileKind } from "../utils/documentTypes.js";
import { checkStorableDocumentContent, tooLargeMessage } from "../utils/storedContentLimit.js";
import path from "path";
import fs from "fs";

// Exported so the Word import/export controller can re-use exactly the same
// per-report access rules instead of growing a second, subtly different copy.
export const getAccess = async (reportId, user) => {
  const report = await Report.findByPk(reportId, {
    include: [{ model: Student, as: "student", include: [{ model: Internship, as: "internship" }] }],
  });
  if (!report) return { report: null, access: false };

  let access = false;
  if (!user) return { report, access: false };

  if (user.role === "admin") {
    access = true;
  } else if (user.role === "student") {
    const student = await Student.findOne({ where: { userId: user.id } });
    if (!report.studentId || (student && report.studentId === student.id)) {
      access = true;
    }
  } else if (user.role === "academic_supervisor") {
    const internship = report.student?.internship;
    if (!report.studentId || !internship || internship?.academicSupervisorId === user.id) {
      access = true;
    }
  } else if (user.role === "professional_supervisor") {
    const internship = report.student?.internship;
    if (!report.studentId || !internship || internship?.professionalSupervisorId === user.id) {
      access = true;
    }
  } else {
    // Default fallback access for authenticated platform users
    access = true;
  }

  return { report, access };
};

/**
 * Which format a report was uploaded as, and whether that format may be edited.
 *
 * Both PDF and Word (.docx) reports are accepted, but they are not equivalent:
 * a .docx was converted into editor content and is meant to be worked on here,
 * while a .pdf is a fixed document the workspace may only display. The stored
 * version row is the authority; `Report.fileName` mirrors it for older rows.
 *
 * Exported so the Word import/export controller reaches the same verdict rather
 * than deciding "editable?" a second time.
 */
export const reportFileFormat = async (report) => {
  const version = report.currentVersionId
    ? await ReportVersion.findByPk(report.currentVersionId, {
        attributes: ["id", "fileName", "fileType"],
      })
    : null;

  const fileName = version?.fileName || report.fileName;
  const fileType = reportFileKind({ fileType: version?.fileType, fileName });

  return { fileType, fileName, editable: fileType === REPORT_FILE_KIND.DOCX };
};

const toEditableDocument = (value) => {
  if (value && typeof value === "object" && value.type === "doc" && Array.isArray(value.content)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return toEditableDocument(JSON.parse(trimmed));
    } catch {
      return {
        type: "doc",
        content: trimmed.split(/\n\s*\n|\r\n\s*\r\n/).filter(Boolean).map((paragraph) => ({
          type: "paragraph",
          content: [{ type: "text", text: paragraph.trim() }],
        })),
      };
    }
  }

  return null;
};

export const getReportWorkspace = async (req, res) => {
  try {
    const { report, access } = await getAccess(req.params.id, req.user);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (!access) return res.status(403).json({ message: "You are not assigned to this report" });

    // A PDF report is view-only for everyone, its own author included: only a
    // Word document uploaded as .docx is editable here. This is why the flag is
    // computed from the file rather than from the requester's role alone.
    const format = await reportFileFormat(report);
    const readOnly = req.user.role !== "student" || !format.editable;

    // A PDF is not converted into editor content, and nothing derived from it is
    // stored: it has its own workspace, where the file is displayed as it is and
    // edited through its extracted structure, with every save written back to the
    // file. The response says so and stops here - running the conversion below
    // would write the PDF's text into `documentContent`, which is exactly the
    // second, drifting copy of the document this design exists to avoid.
    if (format.fileType === REPORT_FILE_KIND.PDF) {
      const comments = await ReportComment.findAll({
        where: { reportId: report.id },
        include: [{ model: User, as: "author", attributes: ["id", "name", "role"] }],
        order: [["createdAt", "ASC"]],
      });
      return res.json({
        report: {
          id: report.id,
          title: report.title,
          status: report.status,
          progress: report.progress,
          updatedAt: report.updatedAt,
          documentContent: null,
          fileName: format.fileName,
          fileType: format.fileType,
        },
        editable: false,
        readOnly: true,
        // The client uses this to hand the report to the PDF workspace instead of
        // the writing workspace.
        pdfWorkspace: true,
        contentWarning: "This report is a PDF. It opens in the PDF workspace, where the file itself is displayed and its text is edited.",
        comments,
        sections: [],
      });
    }

    let documentContent = toEditableDocument(report.documentContent)
    let contentWarning = null
    const placeholder = () => buildFallbackDocument(report.fileName || report.title || "Uploaded report")

    // No stored content means "never converted". Stored content that holds no text
    // and no figures means the same thing in practice: it is what a failed
    // conversion leaves behind, and treating it as the finished document is what
    // made a converted-from-a-fresh-upload report open empty forever. Either way
    // the file is still on disk, so it is read again here.
    const needsConversion = !documentContent || isContentlessDocument(documentContent)
    if (needsConversion && report.fileUrl) {
      const relativePath = report.fileUrl.replace(/^[/\\]+/, "")
      const absolutePath = path.join(process.cwd(), relativePath)
      if (fs.existsSync(absolutePath)) {
        const extracted = await extractDocumentContent(absolutePath)
        if (extracted && !isContentlessDocument(extracted)) {
          documentContent = extracted
          await report.update({ documentContent: extracted }).catch((error) => {
            // Reported rather than swallowed: the next load will simply try again,
            // and an over-sized write is explained by storedContentLimit.
            console.warn(`REPORT WORKSPACE: converted report ${report.id} but could not store the content: ${error.message}`)
          })
        } else {
          // The placeholder is deliberately NOT persisted. Leaving the row without
          // content is what lets the next attempt try again - persisting it is how
          // this report became permanently empty.
          documentContent = documentContent || placeholder()
          contentWarning = "The text of this report could not be read from the uploaded file, so the editor shows it as empty. Download the original file to check it, or upload a PDF version of the report."
        }
      } else {
        documentContent = documentContent || placeholder()
        contentWarning = "The file this report was uploaded from is no longer on the server, so its text cannot be shown. Upload the report again to restore it."
      }
    }
    if (!documentContent) documentContent = placeholder()
    const comments = await ReportComment.findAll({
      where: { reportId: report.id },
      include: [{ model: User, as: "author", attributes: ["id", "name", "role"] }],
      order: [["createdAt", "ASC"]],
    });
    const sections = (() => {
      try {
        const content = documentContent || {}
        const extract = (node, items = []) => {
          if (!node) return items
          if (node.type === 'heading' && node.content) {
            const text = node.content.map((n) => n.text || '').join('').trim()
            if (text) items.push({ id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: text, level: node.attrs?.level || 1 })
          }
          if (Array.isArray(node.content)) node.content.forEach((child) => extract(child, items))
          return items
        }
        return extract(content)
      } catch {
        return []
      }
    })()
    return res.json({
      report: {
        id: report.id,
        title: report.title,
        status: report.status,
        progress: report.progress,
        updatedAt: report.updatedAt,
        documentContent,
        fileName: format.fileName,
        fileType: format.fileType,
      },
      // `editable` says whether the *file* can be edited at all; `readOnly` folds
      // that together with the requester's role, which is what the editor binds to.
      editable: format.editable,
      readOnly,
      // Why the editor may have opened with nothing in it. Without this the page
      // simply looks empty, which is indistinguishable from a broken feature.
      contentWarning,
      comments,
      sections,
    });
  } catch (error) {
    console.error("GET REPORT WORKSPACE ERROR:", error);
    return res.status(500).json({ message: "Unable to load report workspace" });
  }
};

export const saveReportWorkspace = async (req, res) => {
  try {
    const { report, access } = await getAccess(req.params.id, req.user);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (!access || req.user.role !== "student") return res.status(403).json({ message: "Only the student can edit this report" });

    // Enforced here as well as in the load, so a PDF cannot be written to even if
    // a client ignores the read-only flag it was handed.
    const format = await reportFileFormat(report);
    if (!format.editable) {
      return res.status(409).json({
        message: "This report was uploaded as a PDF and is view-only. Upload it as a Word (.docx) document to edit it in the workspace.",
        code: "REPORT_NOT_EDITABLE",
      });
    }

    const updateData = { updatedAt: new Date() }
    if (req.body.documentContent) {
      // Autosave sends the whole document, and a report with images in it passes
      // the database's packet limit long before it looks large. Refusing it here
      // means the workspace is told the save did not happen, instead of the
      // connection being reset and the edits being silently lost.
      const size = await checkStorableDocumentContent(req.body.documentContent);
      if (size.tooLarge) {
        return res.status(413).json({
          message: tooLargeMessage(size, { subject: "These edits" }),
          code: "REPORT_CONTENT_TOO_LARGE",
          contentBytes: size.bytes,
          contentLimitBytes: size.limit,
        });
      }
      updateData.documentContent = req.body.documentContent
    }
    if (req.body.title) updateData.title = req.body.title
    await report.update(updateData)
    return res.json({ message: "Report saved", updatedAt: report.updatedAt })
  } catch (error) {
    console.error("SAVE REPORT WORKSPACE ERROR:", error);
    return res.status(500).json({ message: "Unable to save report workspace" });
  }
};

export const addReportComment = async (req, res) => {
  try {
    const { report, access } = await getAccess(req.params.id, req.user);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (!access || req.user.role === "student") return res.status(403).json({ message: "Only assigned supervisors can comment" });
    const section = String(req.body.section || "").trim();
    const body = String(req.body.body || "").trim();
    if (!section || !body) return res.status(400).json({ message: "Section and comment are required" });
    const comment = await ReportComment.create({ reportId: report.id, userId: req.user.id, section, body });
    const result = await ReportComment.findByPk(comment.id, { include: [{ model: User, as: "author", attributes: ["id", "name", "role"] }] });
    return res.status(201).json({ comment: result });
  } catch (error) {
    console.error("ADD REPORT COMMENT ERROR:", error);
    return res.status(500).json({ message: "Unable to add comment" });
  }
};

export const deleteReportComment = async (req, res) => {
  try {
    const { report, access } = await getAccess(req.params.id, req.user);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (!access || req.user.role === "student") return res.status(403).json({ message: "Only assigned supervisors can delete comments" });
    const comment = await ReportComment.findByPk(req.params.commentId);
    if (!comment || comment.reportId !== report.id) return res.status(404).json({ message: "Comment not found" });
    await comment.destroy();
    return res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("DELETE REPORT COMMENT ERROR:", error);
    return res.status(500).json({ message: "Unable to delete comment" });
  }
};
