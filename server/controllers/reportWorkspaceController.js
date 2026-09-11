import Report from "../models/reportModel.js";
import ReportComment from "../models/reportCommentModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import Internship from "../models/studentAssignmentModel.js";
import extractPdfText, { buildFallbackDocument } from "../utils/extractPdfText.js";
import path from "path";
import fs from "fs";

const getAccess = async (reportId, user) => {
  const report = await Report.findByPk(reportId, {
    include: [{ model: Student, as: "student", include: [{ model: Internship, as: "internship" }] }],
  });
  if (!report) return { report: null, access: false };
  const internship = report.student?.internship;
  const isStudent = user.role === "student" && report.student?.userId === user.id;
  const isAcademic = user.role === "academic_supervisor" && internship?.academicSupervisorId === user.id;
  const isProfessional = user.role === "professional_supervisor" && internship?.professionalSupervisorId === user.id;
  return { report, access: isStudent || isAcademic || isProfessional };
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
    let documentContent = toEditableDocument(report.documentContent)
    if (!documentContent && report.fileUrl) {
      const relativePath = report.fileUrl.replace(/^[/\\]+/, "")
      const absolutePath = path.join(process.cwd(), relativePath)
      if (fs.existsSync(absolutePath)) {
        const extracted = await extractPdfText(absolutePath)
        if (extracted) {
          documentContent = extracted
          await report.update({ documentContent: extracted }).catch(() => {})
        } else {
          documentContent = buildFallbackDocument(report.fileName || report.title || "Uploaded report")
          await report.update({ documentContent }).catch(() => {})
        }
      } else {
        documentContent = buildFallbackDocument(report.fileName || report.title || "Uploaded report")
      }
    } else if (!documentContent) {
      documentContent = buildFallbackDocument(report.fileName || report.title || "Uploaded report")
    }
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
      report: { id: report.id, title: report.title, status: report.status, progress: report.progress, updatedAt: report.updatedAt, documentContent },
      readOnly: req.user.role !== "student",
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
    const updateData = { updatedAt: new Date() }
    if (req.body.documentContent) updateData.documentContent = req.body.documentContent
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
