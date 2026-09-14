import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
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
    const hasPdfExtension = path.extname(file.originalname).toLowerCase() === ".pdf";
    const hasPdfMime = file.mimetype === "application/pdf";
    const accepted = hasPdfExtension && hasPdfMime;
    callback(accepted ? null : new Error("Only PDF reports are supported"), accepted);
  },
});

// Translate Multer's limit errors into clean JSON rather than an opaque 500.
const uploadReport = (req, res, next) =>
  upload.single("report")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: `File is too large. The maximum size is ${MAX_REPORT_BYTES / (1024 * 1024)} MB.`,
      });
    }
    return res.status(400).json({ message: error.message || "Invalid file upload." });
  });

const studentOnly = authorize("student");

router.get("/me", protect, studentOnly, getMyProfile);
router.get("/dashboard-stats", protect, studentOnly, getDashboardStats);
router.get("/my-reports", protect, studentOnly, getMyReports);
router.post("/reports", protect, studentOnly, uploadReport, submitReport);
router.delete("/reports/:id", protect, studentOnly, deleteReport);
router.post("/reports/:id/send-to-supervisor", protect, studentOnly, sendReportToSupervisor);
router.post("/reports/:id/send-to-ai", protect, studentOnly, sendReportToAi);
router.get("/my-final-grade", protect, studentOnly, getMyFinalGrade);
router.get("/my-supervisor-feedback", protect, studentOnly, getMySupervisorFeedback);
router.get("/my-meetings", protect, studentOnly, getMyMeetings);
router.get("/my-notifications", protect, studentOnly, getMyNotifications);
router.put("/notifications/:id/read", protect, studentOnly, markNotificationRead);
router.get("/my-tasks", protect, studentOnly, getMyTasks);
router.put("/tasks/:id/toggle", protect, studentOnly, toggleTaskComplete);
router.put("/tasks/:id/progress", protect, studentOnly, updateTaskProgress);
router.post("/tasks/:id/submit", protect, studentOnly, submitTask);
router.get("/tasks/:id/feedback", protect, studentOnly, getTaskFeedback);

export default router;
