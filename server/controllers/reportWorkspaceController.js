import Report from "../models/reportModel.js";
import ReportComment from "../models/reportCommentModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import Internship from "../models/studentAssignmentModel.js";

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

export const getReportWorkspace = async (req, res) => {
  try {
    const { report, access } = await getAccess(req.params.id, req.user);
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (!access) return res.status(403).json({ message: "You are not assigned to this report" });
    const comments = await ReportComment.findAll({
      where: { reportId: report.id },
      include: [{ model: User, as: "author", attributes: ["id", "name", "role"] }],
      order: [["createdAt", "ASC"]],
    });
    return res.json({
      report: { id: report.id, title: report.title, status: report.status, progress: report.progress, updatedAt: report.updatedAt, documentContent: report.documentContent },
      readOnly: req.user.role !== "student",
      comments,
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
    await report.update({ documentContent: req.body.documentContent, updatedAt: new Date() });
    return res.json({ message: "Report saved", updatedAt: report.updatedAt });
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
