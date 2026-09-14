import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import Task from "../models/taskModel.js";
import { Op } from "sequelize";
import extractPdfText from "../utils/extractPdfText.js";
import fs from "fs";
import path from "path";
import { extractTextFromPDF } from "../services/pdfService.js";
import { generateGeminiResponse } from "../services/geminiService.js";
import { buildReportReviewPrompt } from "../prompts/reportReviewPrompt.js";
import { computeComposite } from "../utils/gradeCalculator.js";
import { consumeAiRequest, refundAiRequest } from "../utils/aiQuota.js";

const getOrCreateStudent = async (userId) => {
  let student = await Student.findOne({ where: { userId } });
  if (!student) {
    const user = await User.findByPk(userId);
    if (user && user.role === "student") {
      student = await Student.create({
        userId: user.id,
        matricule: `STU-${user.id}`,
        class: "General",
      });
    }
  }
  return student;
};

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    let student = await Student.findOne({
      where: { userId },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "role"],
        },
        {
          model: Internship,
          as: "internship",
          include: [
            {
              model: User,
              as: "academicSupervisor",
              attributes: ["id", "name", "email", "role"],
            },
            {
              model: User,
              as: "professionalSupervisor",
              attributes: ["id", "name", "email", "role"],
            },
          ],
        },
      ],
    });

    if (!student) {
      await getOrCreateStudent(userId);
      student = await Student.findOne({
        where: { userId },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "role"],
          },
          {
            model: Internship,
            as: "internship",
            include: [
              {
                model: User,
                as: "academicSupervisor",
                attributes: ["id", "name", "email", "role"],
              },
              {
                model: User,
                as: "professionalSupervisor",
                attributes: ["id", "name", "email", "role"],
              },
            ],
          },
        ],
      });
    }

    if (!student) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    // Return information
    return res.status(200).json({
      student: {
        id: student.id,
        name: student.user?.name,
        email: student.user?.email,
        role: student.user?.role,
        matricule: student.matricule,
        class: student.class,
      },

      internship: student.internship
        ? {
            company: student.internship.company,

            academicSupervisor:
              student.internship.academicSupervisor
                ? {
                    id: student.internship.academicSupervisor.id,
                    name: student.internship.academicSupervisor.name,
                    email: student.internship.academicSupervisor.email,
                  }
                : null,

            professionalSupervisor:
              student.internship.professionalSupervisor
                ? {
                    id: student.internship.professionalSupervisor.id,
                    name: student.internship.professionalSupervisor.name,
                    email: student.internship.professionalSupervisor.email,
                  }
                : null,
          }
        : null,
    });

  } catch (error) {
    console.error(
      "GET STUDENT PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error while retrieving student profile",
      error: error.message,
    });
  }
};

const getMyReports = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await Student.findOne({ where: { userId } });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const reports = await Report.findAll({
      where: { studentId: student.id },
      order: [["submittedAt", "DESC"]],
    });

    return res.status(200).json({ reports });
  } catch (error) {
    console.error("GET MY REPORTS ERROR:", error);
    return res.status(500).json({
      message: "Server error while retrieving reports",
      error: error.message,
    });
  }
};

const submitReport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Please attach a report file" });

    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const title = (req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "")).trim();
    const filePath = req.file.path
    let documentContent = null
    try {
      documentContent = await extractPdfText(filePath)
    } catch {
      documentContent = null
    }

    const existing = await Report.findOne({ where: { studentId: student.id } });
    if (existing) {
      const updated = await existing.update({
        title: title || existing.title || "Internship report",
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        version: (existing.version || 1) + 1,
        status: "submitted",
        submittedAt: new Date(),
        progress: 10,
        documentContent,
      });
      return res.status(200).json({ message: "Report updated successfully. Send it to your supervisor or AI for analysis when ready.", report: updated });
    }

    const report = await Report.create({
      studentId: student.id,
      title: title || "Internship report",
      fileName: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      version: 1,
      status: "submitted",
      submittedAt: new Date(),
      progress: 10,
      documentContent,
    });

    return res.status(201).json({ message: "Report uploaded. Send it to your supervisor or AI for analysis when ready.", report });
  } catch (error) {
    console.error("SUBMIT REPORT ERROR:", error);
    return res.status(500).json({ message: "Unable to submit report", error: error.message });
  }
};

const deleteReport = async (req, res) => {
  try {
    const student = await getOrCreateStudent(req.user.id);
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const report = await Report.findOne({ where: { id: req.params.id, studentId: student.id } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    await report.destroy();
    return res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("DELETE REPORT ERROR:", error);
    return res.status(500).json({ message: "Unable to delete report", error: error.message });
  }
};

const sendReportToSupervisor = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const report = await Report.findOne({ where: { id: req.params.id, studentId: student.id } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    const internship = await Internship.findOne({ where: { studentId: student.id } });
    if (!internship) return res.status(400).json({ message: "Internship assignment not found" });

    const type = String(req.body.type || req.query.type || "academic").toLowerCase();
    const isAcademic = type === "academic"
    const supervisorId = isAcademic ? internship.academicSupervisorId : internship.professionalSupervisorId
    const supervisorTypeLabel = isAcademic ? "academic" : "professional"

    if (!supervisorId) {
      return res.status(400).json({ message: `You must be assigned to a ${supervisorTypeLabel} supervisor before sending a report` });
    }

    await report.update({
      status: "in_review",
      submittedAt: report.submittedAt || new Date(),
      progress: report.progress || 50,
    });

    await Notification.create({
      userId: supervisorId,
      title: "New report submitted",
      message: `A student has submitted \"${report.title}\" for your review.`,
      type: "info",
    });

    return res.status(200).json({ message: `Report sent to your ${supervisorTypeLabel} supervisor for review`, report, supervisorType: supervisorTypeLabel });
  } catch (error) {
    console.error("SEND REPORT TO SUPERVISOR ERROR:", error);
    return res.status(500).json({ message: "Unable to send report", error: error.message });
  }
};

const sendReportToAi = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const report = await Report.findOne({ where: { id: req.params.id, studentId: student.id } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    // --- Read the PDF file from disk and extract text FIRST ---
    // Extraction now happens before any state change or quota charge, so a PDF
    // whose text cannot be read costs the student nothing and leaves the report
    // exactly as it was.
    let pdfText = null;
    if (report.fileUrl) {
      try {
        const relativeFile = report.fileUrl.replace(/^\/uploads\//, "");
        const filePath = path.join(process.cwd(), "uploads", relativeFile);
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          const extracted = await extractTextFromPDF(buffer);
          pdfText = extracted.text;
        }
      } catch (pdfErr) {
        console.error("PDF read/extract error (will skip AI):", pdfErr.message);
      }
    }

    if (!pdfText) {
      return res.status(200).json({
        message: "Unable to extract text from this PDF — please ensure it contains selectable text. No AI request was used.",
        report,
      });
    }

    // --- Enforce the daily quota BEFORE touching report state ---
    // Charging first means a quota rejection cannot leave the report mid-flight.
    const quota = await consumeAiRequest(student);

    // Remember the prior state so a failed AI call can be undone.
    const previousState = { status: report.status, progress: report.progress };

    // Mark as in-progress so the UI can reflect it
    await report.update({ status: "ai_analysis", progress: Math.max(report.progress || 0, 20) });

    // --- Call Gemini ---
    const prompt = buildReportReviewPrompt(pdfText);

    let rawResponse;
    try {
      rawResponse = await generateGeminiResponse(prompt);
    } catch (aiError) {
      // Restore the report and refund the request: a failed attempt must not
      // consume the daily allowance or strand the report in "ai_analysis".
      await report.update({ status: previousState.status, progress: previousState.progress });
      const refunded = await refundAiRequest(student);
      console.error("AI ANALYSIS FAILED (state restored, quota refunded):", aiError.message);
      return res.status(aiError.statusCode || 500).json({
        message: aiError.message || "Unable to send report to AI",
        report,
        ...(refunded ? { quota: refunded } : {}),
      });
    }

    // Strip markdown fences if any
    const cleaned = rawResponse
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    let review;
    try {
      review = JSON.parse(cleaned);
    } catch {
      console.error("Gemini response was not valid JSON:", cleaned.slice(0, 300));
      // The AI produced nothing usable, so undo the state change and refund the request.
      await report.update({ status: previousState.status, progress: previousState.progress });
      const refunded = await refundAiRequest(student);
      return res.status(200).json({
        message: "AI analysis ran but the response could not be parsed. Your daily request has been refunded — please try again.",
        report,
        ...(refunded ? { quota: refunded } : {}),
      });
    }

    // --- Map Gemini response to the aiAnalysis shape the frontend expects ---
    const summary = review.reviewSummary || {};

    // metrics: { structure, clarity, grammar, originality, references } (0-100)
    const metrics = {
      structure: summary.structureScore ?? 0,
      clarity: summary.languageScore ?? 0,
      grammar: summary.languageScore ?? 0,
      originality: summary.academicScore ?? 0,
      references: summary.requirementsScore ?? 0,
    };

    // suggestions: map issues → suggestion cards
    const suggestions = (review.issues || []).slice(0, 20).map((issue, idx) => ({
      id: idx + 1,
      section: issue.section || "",
      location: issue.location || issue.section || "",
      originalText: issue.originalText || "",
      title: issue.explanation?.slice(0, 80) || issue.category || "Issue",
      desc: issue.explanation || "",
      suggestion: issue.suggestion || "",
      type: issue.severity?.toLowerCase() === "high" ? "high"
           : issue.severity?.toLowerCase() === "medium" ? "medium"
           : "low",
    }));

    // strengths as extra positive suggestions
    (review.strengths || []).slice(0, 5).forEach((strength, idx) => {
      suggestions.push({
        id: suggestions.length + idx + 1,
        section: "Strengths",
        title: strength.slice(0, 80),
        desc: strength,
        suggestion: "",
        type: "positive",
      });
    });

    // overall aiScore: map 0-100 → 0-10
    const overallScore = summary.overallScore ?? 0;
    const aiScore = parseFloat((overallScore / 10).toFixed(1));

    const aiAnalysis = {
      metrics,
      suggestions,
      reviewSummary: summary,
      sectionReview: review.sectionReview || [],
      missingRequirements: review.missingRequirements || [],
      generalFeedback: review.generalFeedback || [],
      strengths: review.strengths || [],
      issueCounts: summary.issueCounts || { high: 0, medium: 0, low: 0 },
      analyzedAt: new Date().toISOString(),
    };

    const updated = await report.update({
      status: "ai_analysis",
      progress: 50,
      aiScore,
      aiAnalysis,
    });

    return res.status(200).json({
      message: "AI analysis complete",
      report: updated,
      aiScore,
      quota,
    });
  } catch (error) {
    console.error("SEND REPORT TO AI ERROR:", error);
    return res.status(error.statusCode || 500).json({ message: error.message || "Unable to send report to AI", ...(error.requestsRemaining != null ? { requestsRemaining: error.requestsRemaining } : {}) });
  }
};

const getMyMeetings = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await Student.findOne({ where: { userId } });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const now = new Date();

    const upcomingMeetings = await Meeting.findAll({
      where: {
        studentId: student.id,
        status: "scheduled",
        date: { [Op.gte]: now },
      },
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["date", "ASC"]],
    });

    const meetingHistory = await Meeting.findAll({
      where: {
        studentId: student.id,
        date: { [Op.lt]: now },
      },
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "email"],
        },
      ],
      order: [["date", "DESC"]],
      limit: 20,
    });

    return res.status(200).json({
      meetings: upcomingMeetings,
      upcomingMeetings,
      meetingHistory,
    });
  } catch (error) {
    console.error("GET MY MEETINGS ERROR:", error);
    return res.status(500).json({
      message: "Server error while retrieving meetings",
      error: error.message,
    });
  }
};

const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit: 20,
    });

    return res.status(200).json({ notifications });
  } catch (error) {
    console.error("GET MY NOTIFICATIONS ERROR:", error);
    return res.status(500).json({
      message: "Server error while retrieving notifications",
      error: error.message,
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await notification.update({ isRead: true });

    return res.status(200).json({ message: "Notification marked as read", notification });
  } catch (error) {
    console.error("MARK NOTIFICATION READ ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating notification",
      error: error.message,
    });
  }
};

const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await Student.findOne({ where: { userId } });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const tasks = await Task.findAll({
      where: { studentId: student.id },
      order: [["dueDate", "ASC"]],
    });

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error("GET MY TASKS ERROR:", error);
    return res.status(500).json({
      message: "Server error while retrieving tasks",
      error: error.message,
    });
  }
};

const toggleTaskComplete = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const student = await Student.findOne({ where: { userId } });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const task = await Task.findOne({
      where: { id, studentId: student.id },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const newCompleted = !task.completed;
    await task.update({
      completed: newCompleted,
      status: newCompleted ? "completed" : "pending",
      progress: newCompleted ? 100 : task.progress,
    });

    return res.status(200).json({ message: "Task updated", task });
  } catch (error) {
    console.error("TOGGLE TASK ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating task",
      error: error.message,
    });
  }
};

const updateTaskProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { progress } = req.body;

    const student = await Student.findOne({ where: { userId } });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const task = await Task.findOne({ where: { id, studentId: student.id } });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const clampedProgress = Math.min(100, Math.max(0, parseInt(progress) || 0));
    const newStatus = clampedProgress === 100 ? "completed" : clampedProgress > 0 ? "in_progress" : "pending";

    await task.update({
      progress: clampedProgress,
      status: newStatus,
      completed: clampedProgress === 100,
    });

    return res.status(200).json({ message: "Progress updated", task });
  } catch (error) {
    console.error("UPDATE TASK PROGRESS ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const submitTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { submissionNote, workUrl } = req.body;

    const student = await Student.findOne({
      where: { userId },
      include: [{ model: User, as: "user", attributes: ["name", "email"] }],
    });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const task = await Task.findOne({ where: { id, studentId: student.id } });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    await task.update({
      status: "submitted",
      completed: false,
      progress: 100,
      submittedAt: new Date(),
      submissionNote: submissionNote ? submissionNote.trim() : null,
      workUrl: workUrl ? workUrl.trim() : null,
    });

    // Notify Supervisor(s)
    const studentName = student.user?.name || "Student";
    const notifySupervisorIds = new Set();
    if (task.supervisorId) notifySupervisorIds.add(task.supervisorId);

    // Also check internship assignment for both Academic & Professional Supervisors
    const internship = await Internship.findOne({ where: { studentId: student.id } });
    if (internship) {
      if (internship.academicSupervisorId) notifySupervisorIds.add(internship.academicSupervisorId);
      if (internship.professionalSupervisorId) notifySupervisorIds.add(internship.professionalSupervisorId);
    }

    for (const supervisorId of notifySupervisorIds) {
      await Notification.create({
        userId: supervisorId,
        title: "Task Submitted for Review",
        message: `${studentName} submitted work for task: "${task.title}". Please inspect and review.`,
        type: "info",
      }).catch((err) => console.error("Notification creation error:", err));
    }

    return res.status(200).json({ message: "Task submitted successfully to supervisor for review", task });
  } catch (error) {
    console.error("SUBMIT TASK ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getTaskFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const student = await Student.findOne({ where: { userId } });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const task = await Task.findOne({ where: { id, studentId: student.id } });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.status(200).json({
      feedback: task.feedback,
      feedbackAt: task.feedbackAt,
      task,
    });
  } catch (error) {
    console.error("GET TASK FEEDBACK ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await Student.findOne({ where: { userId } });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    // Reports
    const reports = await Report.findAll({
      where: { studentId: student.id },
      // Select only the columns needed for dashboard metrics. This keeps the
      // dashboard compatible with databases created before newer report fields
      // (such as submittedAt) were added.
      attributes: ["id", "status", "aiScore", "createdAt"],
    });
    const totalReports = reports.length;
    const submittedReports = reports.filter(
      (r) => ["submitted", "ai_analysis", "in_review", "approved"].includes(r.status)
    ).length;
    const approvedReports = reports.filter((r) => r.status === "approved").length;

    // AI Score — average of all reports that have an aiScore
    const reportsWithScore = reports.filter((r) => r.aiScore !== null);
    const avgAiScore = reportsWithScore.length > 0
      ? parseFloat((reportsWithScore.reduce((sum, r) => sum + r.aiScore, 0) / reportsWithScore.length).toFixed(1))
      : null;

    // Latest AI score
    const latestReportWithScore = reports
      .filter((r) => r.aiScore !== null)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const latestAiScore = latestReportWithScore ? latestReportWithScore.aiScore : null;

    // Tasks
    const tasks = await Task.findAll({ where: { studentId: student.id } });
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;

    // Overall progress (based on tasks if available, otherwise reports)
    let overallProgress = 0;
    if (totalTasks > 0) {
      overallProgress = Math.round((completedTasks / totalTasks) * 100);
    } else if (totalReports > 0) {
      overallProgress = Math.round((approvedReports / totalReports) * 100);
    }

    // Meetings
    const completedMeetings = await Meeting.count({
      where: { studentId: student.id, status: "completed" },
    });
    const totalMeetings = await Meeting.count({
      where: { studentId: student.id },
    });

    // Pending supervisor feedback (reports in_review status)
    const pendingFeedback = reports.filter(
      (r) => r.status === "in_review" || r.status === "needs_revision"
    ).length;

    return res.status(200).json({
      overallProgress,
      latestAiScore,
      avgAiScore,
      submittedReports,
      totalReports,
      pendingFeedback,
      completedMeetings,
      totalMeetings,
      completedTasks,
      totalTasks,
    });
  } catch (error) {
    console.error("GET DASHBOARD STATS ERROR:", error);
    return res.status(500).json({
      message: "Server error while retrieving dashboard stats",
      error: error.message,
    });
  }
};

const getMyFinalGrade = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const internship = await Internship.findOne({ where: { studentId: student.id } });
    if (!internship) return res.status(404).json({ message: "Internship not found" });

    const academicMaxTotal = internship.academicGradeBreakdown?.reduce((sum, item) => sum + (item.max || 0), 0) || 20;
    const professionalMaxTotal = internship.professionalGradeBreakdown?.reduce((sum, item) => sum + (item.max || 0), 0) || 10;

    // Derived on read as well as persisted, so the figure stays correct for
    // internships graded before the composite existed.
    const composite = computeComposite({
      academicGrade: internship.academicGrade,
      academicSubmitted: internship.academicGradeStatus === "submitted" && internship.academicGrade != null,
      professionalGrade: internship.professionalGrade,
      professionalSubmitted: internship.professionalGradeStatus === "submitted" && internship.professionalGrade != null,
    });

    return res.status(200).json({
      grade: {
        academic: {
          finalGrade: internship.academicGrade,
          maxTotal: academicMaxTotal,
          breakdown: internship.academicGradeBreakdown,
          gradeStatus: internship.academicGradeStatus,
          gradeSubmittedAt: internship.academicGradeSubmittedAt,
        },
        professional: {
          finalGrade: internship.professionalGrade,
          maxTotal: professionalMaxTotal,
          breakdown: internship.professionalGradeBreakdown,
          gradeStatus: internship.professionalGradeStatus,
          gradeSubmittedAt: internship.professionalGradeSubmittedAt,
        },
        // The combined final mark (FR-GRD-01). `finalized` is only true once BOTH
        // supervisors have submitted, and `final.score` is null until then
        // (FR-GRD-03) rather than showing a misleading partial total.
        final: composite,
        finalized: composite.ready,
      },
    });
  } catch (error) {
    console.error("GET MY FINAL GRADE ERROR:", error);
    return res.status(500).json({ message: "Server error while fetching grade", error: error.message });
  }
};

const getMySupervisorFeedback = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const internship = await Internship.findOne({
      where: { studentId: student.id },
      include: [
        { model: User, as: "academicSupervisor", attributes: ["id", "name"] },
        { model: User, as: "professionalSupervisor", attributes: ["id", "name"] },
      ],
    });

    const academicSupervisorName = internship?.academicSupervisor?.name || "Academic Supervisor";
    const professionalSupervisorName = internship?.professionalSupervisor?.name || "Professional Supervisor";

    const tasks = await Task.findAll({
      where: { studentId: student.id },
      attributes: [
        "id", "title", "feedbackAcademic", "feedbackAcademicAt", "feedbackAcademicBy",
        "feedbackProfessional", "feedbackProfessionalAt", "feedbackProfessionalBy",
      ],
      order: [["updatedAt", "DESC"]],
    });

    const academicFeedback = tasks
      .filter((t) => t.feedbackAcademic)
      .map((t) => ({
        taskTitle: t.title,
        feedback: t.feedbackAcademic,
        givenAt: t.feedbackAcademicAt,
        supervisorName: academicSupervisorName,
        supervisorType: "academic",
      }));

    const professionalFeedback = tasks
      .filter((t) => t.feedbackProfessional)
      .map((t) => ({
        taskTitle: t.title,
        feedback: t.feedbackProfessional,
        givenAt: t.feedbackProfessionalAt,
        supervisorName: professionalSupervisorName,
        supervisorType: "professional",
      }));

    return res.status(200).json({
      academicFeedback,
      professionalFeedback,
    });
  } catch (error) {
    console.error("GET MY SUPERVISOR FEEDBACK ERROR:", error);
    return res.status(500).json({ message: "Server error while fetching feedback", error: error.message });
  }
};

export {
  getMyProfile,
  getMyReports,
  submitReport,
  deleteReport,
  sendReportToSupervisor,
  sendReportToAi,
  getMyFinalGrade,
  getMySupervisorFeedback,
  getMyMeetings,
  getMyNotifications,
  markNotificationRead,
  getMyTasks,
  toggleTaskComplete,
  updateTaskProgress,
  submitTask,
  getTaskFeedback,
  getDashboardStats,
};
