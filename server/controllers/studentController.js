import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import ReportReview from "../models/reportReviewModel.js";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import Task from "../models/taskModel.js";
import { Op } from "sequelize";
import { extractDocumentContent, extractPlainText, isContentlessDocument } from "../utils/documentExtraction.js";
import { REPORT_FILE_KIND, reportFileKind, isDocxFile } from "../utils/documentTypes.js";
import { checkStorableDocumentContent, tooLargeMessage } from "../utils/storedContentLimit.js";
import fs from "fs";
import path from "path";
import { generateGeminiResponse } from "../services/geminiService.js";
import { buildReportReviewPrompt } from "../prompts/reportReviewPrompt.js";
import { computeComposite } from "../utils/gradeCalculator.js";
import { consumeAiRequest, refundAiRequest } from "../utils/aiQuota.js";
import hashFile from "../utils/fileHash.js";
import {
  assignSupervisorToStudent,
  notifySupervisorAssignment,
  SupervisorProvisioningError,
} from "../services/supervisorProvisioning.js";
import {
  openReviewRound,
  finalSubmitReport as finalSubmitReportWorkflow,
  getCurrentReviews,
  getSubmissionReadiness,
  getInternshipForStudent,
  ReportWorkflowError,
} from "../services/reportWorkflow.js";

/**
 * A report row plus the two fields the client needs to decide what it may do
 * with the file: `fileType` ("docx" | "pdf" | null) and `editable`.
 *
 * Both formats are accepted on upload, but only a Word document can be opened
 * for editing in the writing workspace - a PDF is view-only. The immutable
 * version row is authoritative for the format; `Report.fileName` mirrors it for
 * rows uploaded before versions existed. Deriving this in one place is what
 * keeps My Reports and the workspace from disagreeing about the same file.
 */
const withFileFormat = (report, version = null) => {
  const fileName = version?.fileName || report.fileName;
  const fileType = reportFileKind({ fileType: version?.fileType, fileName });

  return {
    ...report.toJSON(),
    fileType,
    editable: fileType === REPORT_FILE_KIND.DOCX,
    fileSize: version?.fileSize ?? null,
  };
};

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

// PUT /api/students/me/internship
//
// The student - not the admin - introduces their professional supervisor, after
// they have found an internship. This is the student-driven half of the
// supervisor onboarding workflow: the email is resolved to an existing account
// or a new one is created, the student is linked either way, and the supervisor
// is notified. Credentials are emailed only when an account was actually created.
const updateMyInternship = async (req, res) => {
  try {
    const userId = req.user.id;
    const { company, professionalSupervisorEmail, professionalSupervisorName } = req.body || {};

    const student =
      (await Student.findOne({ where: { userId } })) || (await getOrCreateStudent(userId));

    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const supervisorEmail = String(professionalSupervisorEmail || "").trim();
    if (!supervisorEmail) {
      return res.status(400).json({
        message: "Your professional supervisor's email address is required",
      });
    }

    const studentUser = await User.findByPk(userId, { attributes: ["name", "email"] });

    // A student cannot be their own professional supervisor: that would let them
    // reach the supervisor surface, including grading, through their own account.
    if (
      studentUser?.email &&
      studentUser.email.toLowerCase() === supervisorEmail.toLowerCase()
    ) {
      return res.status(400).json({
        message: "You cannot use your own email address as your professional supervisor.",
      });
    }

    const trimmedCompany = String(company ?? "").trim();
    const studentName = studentUser?.name || studentUser?.email;

    const { supervisor, created, temporaryPassword } = await assignSupervisorToStudent({
      studentId: student.id,
      studentName,
      studentEmail: studentUser?.email,
      role: "professional_supervisor",
      email: supervisorEmail,
      name: professionalSupervisorName,
      // An empty box means "leave the company as it is", not "clear it".
      company: trimmedCompany ? trimmedCompany : undefined,
    });

    const notification = await notifySupervisorAssignment({
      supervisor,
      created,
      temporaryPassword,
      role: "professional_supervisor",
      studentName,
      studentEmail: studentUser?.email,
      company: trimmedCompany || null,
    });

    return res.status(created ? 201 : 200).json({
      message: created
        ? `A professional supervisor account was created for ${supervisor.email} and the login details have been emailed to them.`
        : `${supervisor.email} already had an InternSmart account and has been linked as your professional supervisor.`,
      accountCreated: created,
      notification,
      professionalSupervisor: {
        id: supervisor.id,
        name: supervisor.name,
        email: supervisor.email,
      },
    });
  } catch (error) {
    if (error instanceof SupervisorProvisioningError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error("UPDATE MY INTERNSHIP ERROR:", error);
    return res.status(500).json({
      message: "Server error while saving your internship details",
      error: error.message,
    });
  }
};

// POST /api/students/reports/:id/request-submission
//
// Stage one of the two-stage submission: opens a review round for the current
// file, one row per supervisor, and notifies both. The report cannot be
// finalised until both approve.
const requestReportSubmission = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const report = await Report.findOne({ where: { id: req.params.id, studentId: student.id } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    const version = report.currentVersionId
      ? await ReportVersion.findByPk(report.currentVersionId)
      : null;

    if (!version) {
      return res.status(400).json({
        message: "Upload your report before requesting submission.",
        code: "NO_VERSION",
      });
    }

    const result = await openReviewRound(report, version, { actorId: req.user.id });

    return res.status(201).json({
      message:
        "Your report has been sent for review. Both supervisors must validate it before final submission.",
      cycle: result.cycle,
    });
  } catch (error) {
    if (error instanceof ReportWorkflowError) {
      return res.status(error.status).json({
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    console.error("REQUEST REPORT SUBMISSION ERROR:", error);
    return res.status(500).json({
      message: "Unable to request report review",
      error: error.message,
    });
  }
};

// GET /api/students/reports/:id/submission-status
//
// The student sees each supervisor's *state* - pending, approved, rejected and
// any correction reason - but never a mark or confidential comment. The
// confidential columns are excluded by the query, not filtered afterwards
// (integrity rule 9).
const getReportSubmissionStatus = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const report = await Report.findOne({ where: { id: req.params.id, studentId: student.id } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    const internship = await getInternshipForStudent(student.id);
    const reviews = await getCurrentReviews(report, { includePrivate: false });
    const readiness = getSubmissionReadiness(report, internship, reviews);

    const academic = reviews.find((r) => r.supervisorType === "academic");
    const professional = reviews.find((r) => r.supervisorType === "professional");

    return res.status(200).json({
      reportId: report.id,
      title: report.title,
      status: report.status,
      cycle: report.reviewCycle || 1,
      currentVersion: report.currentVersionId
        ? { id: report.currentVersionId, versionNumber: report.version }
        : null,
      reviews: reviews.map((review) => ({
        supervisorType: review.supervisorType,
        status: review.status,
        rejectionReason: review.rejectionReason,
        reviewedAt: review.reviewedAt,
      })),
      academicApproved: academic?.status === "approved",
      professionalApproved: professional?.status === "approved",
      readyForFinalSubmission:
        academic?.status === "approved" && professional?.status === "approved" && !report.lockedAt,
      canRequestSubmission: readiness.canRequestSubmission,
      blockingIssues: readiness.issues,
      submissionRequestedAt: report.submissionRequestedAt,
      finalSubmittedAt: report.finalSubmittedAt,
      locked: Boolean(report.lockedAt),
    });
  } catch (error) {
    console.error("GET REPORT SUBMISSION STATUS ERROR:", error);
    return res.status(500).json({
      message: "Unable to load the submission status",
      error: error.message,
    });
  }
};

// POST /api/students/reports/:id/final-submit
//
// Stage two: only reachable once both supervisors approved, and the approvals
// must still describe the exact file being submitted.
const finalSubmitReport = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const report = await Report.findOne({ where: { id: req.params.id, studentId: student.id } });
    if (!report) return res.status(404).json({ message: "Report not found" });

    const result = await finalSubmitReportWorkflow({
      report,
      student,
      acceptedPlagiarismScore:
        req.body?.acceptedPlagiarismScore === undefined
          ? null
          : req.body.acceptedPlagiarismScore,
    });

    return res.status(200).json({
      message:
        "Your report has been submitted as final and archived. This version can no longer be modified without administrator authorization.",
      finalSubmittedAt: result.submittedAt,
      versionNumber: result.version.versionNumber,
      fileHash: result.version.fileHash,
    });
  } catch (error) {
    if (error instanceof ReportWorkflowError) {
      return res.status(error.status).json({
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    console.error("FINAL SUBMIT REPORT ERROR:", error);
    return res.status(500).json({
      message: "Unable to submit the final report",
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
      attributes: [
        "id",
        "studentId",
        "title",
        "fileName",
        "fileUrl",
        "version",
        "status",
        "progress",
        "aiScore",
        "aiAnalysis",
        "submittedAt",
        "updatedAt",
        "currentVersionId",
        "reviewCycle",
        "submissionRequestedAt",
        "finalSubmittedAt",
        "lockedAt",
      ],
      order: [["submittedAt", "DESC"]],
    });

    // One extra query for the whole list rather than one per report: the format
    // of the current version is what tells the card whether the file can be
    // opened for editing.
    const versionIds = reports
      .map((report) => report.currentVersionId)
      .filter((id) => Number.isInteger(id));

    const versions = versionIds.length
      ? await ReportVersion.findAll({
          where: { id: versionIds },
          attributes: ["id", "fileName", "fileType", "fileSize"],
        })
      : [];

    const versionsById = new Map(versions.map((version) => [version.id, version]));

    return res.status(200).json({
      reports: reports.map((report) => withFileFormat(report, versionsById.get(report.currentVersionId))),
    });
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

    // A Word file is converted into editor content, because that conversion *is*
    // the editable document the writing workspace holds.
    //
    // A PDF is not converted at all. Its content is the file, and the PDF
    // workspace reads the structure out of that file whenever a session starts
    // and writes edits straight back to it - so storing a derived copy in
    // `documentContent` would only create a second version of the document that
    // can drift from the one being displayed. Only the name and the location are
    // kept for a PDF. (The similarity engine reads the file when it needs text;
    // see services/plagiarism/internalProvider.js.)
    // Only the file name and location are stored in the database.
    // The document file on disk is the source of truth, so documentContent is kept null
    // to avoid storing heavy document blobs in SQL.
    documentContent = null;

    // Hash the stored bytes. The approval is bound to this hash, and the final
    // submission re-checks it, so the file cannot be swapped after approval.
    let fileHash = null;
    try {
      fileHash = await hashFile(filePath);
    } catch (hashError) {
      // A missing hash weakens the swap check but must not lose the upload.
      console.warn("REPORT HASH ERROR:", hashError.message);
    }

    let existing = null;
    if (req.body.reportId) {
      existing = await Report.findOne({ where: { id: req.body.reportId, studentId: student.id } });
    } else {
      // Find an existing report of the SAME document format (docx vs pdf).
      // This ensures uploading a Word document does not overwrite a PDF report,
      // and uploading a PDF does not overwrite a Word document — keeping PDF and
      // Word reports independent on their own.
      const isDocx = isDocxFile(req.file);
      const allReports = await Report.findAll({ where: { studentId: student.id }, order: [["updatedAt", "DESC"]] });
      existing = allReports.find((r) => {
        const ext = (r.fileName || "").toLowerCase();
        const rIsDocx = ext.endsWith(".docx") || ext.endsWith(".doc");
        return isDocx ? rIsDocx : !rIsDocx;
      }) || null;
    }

    // A finalised report is immutable; only an administrator may unlock it.
    if (existing?.lockedAt) {
      return res.status(409).json({
        message:
          "This report has been finalised and can no longer be replaced. Contact an administrator if a correction is required.",
        code: "REPORT_LOCKED",
      });
    }

    const nextVersionNumber = existing ? (existing.version || 1) + 1 : 1;
    const fileUrl = `/uploads/${req.file.filename}`;

    const report = existing
      ? await existing.update({
          title: title || existing.title || "Internship report",
          fileName: req.file.originalname,
          fileUrl,
          version: nextVersionNumber,
          status: "submitted",
          submittedAt: new Date(),
          progress: 10,
          documentContent: null,
        })
      : await Report.create({
          studentId: student.id,
          title: title || "Internship report",
          fileName: req.file.originalname,
          fileUrl,
          version: 1,
          status: "submitted",
          submittedAt: new Date(),
          progress: 10,
          documentContent: null,
        });

    // Keep the immutable history. Previously this single row was updated in
    // place, so a corrected report destroyed the version it replaced: the
    // counter advanced while the file it referred to was gone.
    const version = await ReportVersion.create({
      reportId: report.id,
      versionNumber: nextVersionNumber,
      fileName: req.file.originalname,
      fileUrl,
      fileHash,
      fileType: req.file.mimetype || null,
      fileSize: req.file.size || null,
      extractedText: null,
      uploadedBy: req.user.id,
    });

    const updates = { currentVersionId: version.id };

    // Any verdict from an open review round described the *previous* bytes, so
    // it must stop counting. Reviews stay on record but the approval check only
    // ever reads the current cycle, so advancing the cycle invalidates them
    // without destroying history (integrity rules 4 and 12).
    const currentCycle = report.reviewCycle || 1;
    const openReviews = await ReportReview.count({
      where: { reportId: report.id, cycle: currentCycle },
    });

    if (openReviews > 0) {
      updates.reviewCycle = currentCycle + 1;
      updates.submissionRequestedAt = null;
    }

    await report.update(updates);

    return res.status(existing ? 200 : 201).json({
      message: existing
        ? "Report updated successfully. Send it to your supervisors for review when ready."
        : "Report uploaded. Send it to your supervisors for review when ready.",
      // The client needs to know straight away whether the file it just handed
      // over can be opened for editing, or is view-only.
      report: withFileFormat(report, version),
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        fileHash: version.fileHash,
      },
    });
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

    let internship = await Internship.findOne({ where: { studentId: student.id } });
    if (!internship) {
      internship = await Internship.create({ studentId: student.id, company: "Not specified" });
    }

    const type = String(req.body?.type || req.query?.type || "academic").toLowerCase();
    const isAcademic = type === "academic";
    const supervisorId = isAcademic ? internship.academicSupervisorId : internship.professionalSupervisorId;
    const supervisorTypeLabel = isAcademic ? "academic" : "professional";

    if (!supervisorId) {
      return res.status(400).json({ message: `You must be assigned to an ${supervisorTypeLabel} supervisor before sending a report.` });
    }

    await report.update({
      status: "in_review",
      submittedAt: report.submittedAt || new Date(),
      progress: Math.max(report.progress || 0, 50),
    });

    await Notification.create({
      userId: supervisorId,
      title: "New report submitted",
      message: `A student has submitted "${report.title}" for your review.`,
      type: "info",
    });

    return res.status(200).json({ message: `Report sent to your ${supervisorTypeLabel} supervisor for review`, report: withFileFormat(report), supervisorType: supervisorTypeLabel });
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

    // --- Read the report file from disk and extract text FIRST ---
    // Extraction now happens before any state change or quota charge, so a file
    // whose text cannot be read costs the student nothing and leaves the report
    // exactly as it was. PDF and Word (.docx) reports both read here.
    let pdfText = null;
    if (report.fileUrl) {
      try {
        const relativeFile = report.fileUrl.replace(/^\/uploads\//, "");
        const filePath = path.join(process.cwd(), "uploads", relativeFile);
        if (fs.existsSync(filePath)) {
          const extracted = await extractPlainText(filePath);
          pdfText = extracted.text;
        }
      } catch (pdfErr) {
        console.error("Report read/extract error (will skip AI):", pdfErr.message);
      }
    }

    if (!pdfText) {
      return res.status(200).json({
        message: "Unable to extract text from this report — please ensure it contains selectable text. No AI request was used.",
        report: withFileFormat(report),
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
        report: withFileFormat(report),
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
        report: withFileFormat(report),
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
      report: withFileFormat(updated),
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
      include: [
        {
          model: User,
          as: "supervisor",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [
        ["completed", "ASC"],
        ["dueDate", "ASC"],
        ["id", "DESC"],
      ],
    });

    const formattedTasks = tasks.map((t) => {
      const taskJson = t.toJSON();
      const role = taskJson.supervisorRole || taskJson.supervisor?.role || "supervisor";
      const roleLabel =
        role === "academic_supervisor"
          ? "Academic Supervisor"
          : role === "professional_supervisor"
          ? "Professional Supervisor"
          : "Supervisor";

      return {
        ...taskJson,
        supervisorRoleLabel: roleLabel,
        assignedByLabel: taskJson.supervisor?.name
          ? `${taskJson.supervisor.name} (${roleLabel})`
          : roleLabel,
      };
    });

    return res.status(200).json({ tasks: formattedTasks });
  } catch (error) {
    console.error("GET MY TASKS ERROR:", error);
    return res.status(500).json({
      message: "Server error while retrieving tasks",
      error: error.message,
    });
  }
};

const toggleTaskComplete = async (req, res) => {
  return res.status(403).json({
    message: "Students cannot manually mark tasks as complete. Submit your completed work for your supervisor to review and approve.",
  });
};

const updateTaskProgress = async (req, res) => {
  return res.status(403).json({
    message: "Students cannot manually update task progress. Submit your work for your supervisor to review.",
  });
};

const submitTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { submissionNote, workUrl, milestoneId } = req.body;

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

    let milestones = Array.isArray(task.milestones) ? [...task.milestones] : [];

    if (milestoneId && milestones.length > 0) {
      milestones = milestones.map((m) => {
        if (String(m.id) === String(milestoneId)) {
          return {
            ...m,
            status: "submitted",
            submittedAt: new Date(),
            submissionNote: submissionNote ? submissionNote.trim() : m.submissionNote,
            workUrl: workUrl ? workUrl.trim() : m.workUrl,
          };
        }
        return m;
      });
    }

    await task.update({
      status: "submitted",
      completed: false,
      submittedAt: new Date(),
      submissionNote: submissionNote ? submissionNote.trim() : task.submissionNote,
      workUrl: workUrl ? workUrl.trim() : task.workUrl,
      milestones: milestones.length > 0 ? milestones : task.milestones,
    });

    // Notify Supervisor
    const studentName = student.user?.name || "Student";
    if (task.supervisorId) {
      await Notification.create({
        userId: task.supervisorId,
        title: "Task Submission Received",
        message: `${studentName} submitted work for task "${task.title}". Please review and approve/reject.`,
        type: "info",
      }).catch((err) => console.error("Notification creation error:", err));
    }

    return res.status(200).json({ message: "Work submitted successfully for supervisor review", task });
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
  updateMyInternship,
  requestReportSubmission,
  getReportSubmissionStatus,
  finalSubmitReport,
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
