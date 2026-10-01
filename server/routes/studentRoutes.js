import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import { REPORT_UPLOAD_LABEL, isReportDocument, isDocxFile } from "../utils/documentTypes.js";
import { validateDocumentContent } from "../utils/fileContent.js";
import {
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
} from "../controllers/studentController.js";

const router = express.Router();

const uploadDirectory = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const MAX_REPORT_BYTES = 10 * 1024 * 1024; // 10 MB, per NFR-SEC-04

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: MAX_REPORT_BYTES },
  fileFilter: (_req, file, callback) => {
    // Require the declared MIME type as well as the extension. The previous check
    // accepted any upload merely *named* "*.pdf", whatever its content type.
    // Word (.docx) reports are accepted too: the workspace reads them with
    // mammoth, so a student can start from a document written in Word.
    const accepted = isReportDocument(file);
    if (accepted) return callback(null, true);

    const legacyDoc = path.extname(file.originalname).toLowerCase() === ".doc";
    const error = new Error(
      legacyDoc
        ? "Legacy .doc files are not supported. Open the file in Word, save it as .docx, then upload it again."
        : `Only ${REPORT_UPLOAD_LABEL} reports are supported`,
    );
    error.code = "UNSUPPORTED_FILE_FORMAT";
    return callback(error, false);
  },
});

// Translate Multer's limit errors into clean JSON rather than an opaque 500.
const uploadReport = (req, res, next) =>
  upload.single("report")(req, res, (error) => {
    if (error) {
      if (error.code === "UNSUPPORTED_FILE_FORMAT") {
        return res.status(415).json({ message: error.message });
      }
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: `File is too large. The maximum size is ${MAX_REPORT_BYTES / (1024 * 1024)} MB.`,
        });
      }
      return res.status(400).json({ message: error.message || "Invalid file upload." });
    }

    // Content check, after the bytes are on disk. The filter above trusts the
    // declared MIME type and the file name, both of which the client controls; a
    // file renamed to .pdf, or a polyglot carrying a script preamble ahead of a
    // PDF body, passes it and fails here.
    const kind = isDocxFile(req.file || {}) ? "docx" : "pdf";
    let buffer;
    try {
      buffer = fs.readFileSync(req.file.path);
    } catch (readError) {
      return res.status(400).json({ message: `The upload could not be read: ${readError.message}` });
    }

    const verdict = validateDocumentContent(buffer, kind);
    if (!verdict.ok) {
      // Nothing invalid is left in the uploads directory.
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // already gone
      }
      return res.status(415).json({ message: verdict.reason });
    }

    return next();
  });

const studentOnly = authorize("student");

router.get("/me", protect, studentOnly, getMyProfile);
// The student introduces their professional supervisor here once they have an
// internship; the academic supervisor is assigned by the admin instead.
router.put("/me/internship", protect, studentOnly, updateMyInternship);
router.get("/dashboard-stats", protect, studentOnly, getDashboardStats);
router.get("/my-reports", protect, studentOnly, getMyReports);
router.post("/reports", protect, studentOnly, uploadReport, submitReport);
router.delete("/reports/:id", protect, studentOnly, deleteReport);
router.post("/reports/:id/send-to-supervisor", protect, studentOnly, sendReportToSupervisor);
router.post("/reports/:id/send-to-ai", protect, studentOnly, sendReportToAi);

// Two-stage submission: request review, poll the approval state, submit final.
router.post("/reports/:id/request-submission", protect, studentOnly, requestReportSubmission);
router.get("/reports/:id/submission-status", protect, studentOnly, getReportSubmissionStatus);
router.post("/reports/:id/final-submit", protect, studentOnly, finalSubmitReport);
router.get("/my-final-grade", protect, studentOnly, getMyFinalGrade);
router.get("/my-supervisor-feedback", protect, studentOnly, getMySupervisorFeedback);
router.get("/my-meetings", protect, studentOnly, getMyMeetings);
router.get("/my-notifications", protect, studentOnly, getMyNotifications);
router.put("/notifications/:id/read", protect, studentOnly, markNotificationRead);
const taskUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => callback(null, `task-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

router.post("/tasks/upload", protect, studentOnly, taskUpload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file was uploaded." });
  }
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  return res.json({
    message: "Deliverable uploaded successfully",
    fileUrl,
    filename: req.file.originalname,
  });
});

router.get("/my-tasks", protect, studentOnly, getMyTasks);
router.put("/tasks/:id/toggle", protect, studentOnly, toggleTaskComplete);
router.put("/tasks/:id/progress", protect, studentOnly, updateTaskProgress);
router.post("/tasks/:id/submit", protect, studentOnly, submitTask);
router.get("/tasks/:id/feedback", protect, studentOnly, getTaskFeedback);

export default router;
