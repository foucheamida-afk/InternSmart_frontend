import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import protect from "../middleware/authMiddleware.js";
import {
  getMyProfile,
  getMyReports,
  submitReport,
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

router.get("/me", protect, getMyProfile);
router.get("/dashboard-stats", protect, getDashboardStats);
router.get("/my-reports", protect, getMyReports);
router.post("/reports", protect, upload.single("report"), submitReport);
router.post("/reports/:id/send-to-supervisor", protect, sendReportToSupervisor);
router.post("/reports/:id/send-to-ai", protect, sendReportToAi);
router.get("/my-final-grade", protect, getMyFinalGrade);
router.get("/my-supervisor-feedback", protect, getMySupervisorFeedback);
router.get("/my-meetings", protect, getMyMeetings);
router.get("/my-notifications", protect, getMyNotifications);
router.put("/notifications/:id/read", protect, markNotificationRead);
router.get("/my-tasks", protect, getMyTasks);
router.put("/tasks/:id/toggle", protect, toggleTaskComplete);
router.put("/tasks/:id/progress", protect, updateTaskProgress);
router.post("/tasks/:id/submit", protect, submitTask);
router.get("/tasks/:id/feedback", protect, getTaskFeedback);

export default router;
