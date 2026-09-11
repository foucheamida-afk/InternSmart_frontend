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

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set([".pdf"]);
    const accepted = allowed.has(path.extname(file.originalname).toLowerCase());
    callback(accepted ? null : new Error("Only PDF reports are supported"), accepted);
  },
});

const studentOnly = authorize("student");

router.get("/me", protect, studentOnly, getMyProfile);
router.get("/dashboard-stats", protect, studentOnly, getDashboardStats);
router.get("/my-reports", protect, studentOnly, getMyReports);
router.post("/reports", protect, studentOnly, upload.single("report"), submitReport);
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
