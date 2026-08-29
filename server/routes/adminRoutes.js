import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  getDashboardStats,
  getChartData,
  getAllUsers,
  getUserDetail,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
  createUser,
  getAllStudents,
  getAllSupervisors,
  getAllInternships,
  getAllReports,
  updateReport,
  getAllMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getAllNotifications,
  createNotification,
  getAllDefenseAlerts,
  createDefenseAlert,
  updateDefenseAlert,
  importCSV,
} from "../controllers/adminController.js";
import {
  listTimelines,
  createTimeline,
  updateTimeline,
  deleteTimeline,
} from "../controllers/timelineController.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Dashboard stats
router.get("/dashboard", protect, authorize("admin"), getDashboardStats);
router.get("/chart-data", protect, authorize("admin"), getChartData);

// Users
router.get("/users", protect, authorize("admin"), getAllUsers);
router.get("/users/:id", protect, authorize("admin"), getUserDetail);
router.post("/users", protect, authorize("admin"), createUser);
router.put("/users/:id", protect, authorize("admin"), updateUser);
router.put("/users/:id/status", protect, authorize("admin"), toggleUserStatus);
router.put("/users/:id/reset-password", protect, authorize("admin"), resetUserPassword);
router.delete("/users/:id", protect, authorize("admin"), deleteUser);

// Students
router.get("/students", protect, authorize("admin"), getAllStudents);

// Supervisors
router.get("/supervisors", protect, authorize("admin"), getAllSupervisors);

// Internships
router.get("/internships", protect, authorize("admin"), getAllInternships);

// Reports
router.get("/reports", protect, authorize("admin"), getAllReports);
router.put("/reports/:id", protect, authorize("admin"), updateReport);

// Meetings
router.get("/meetings", protect, authorize("admin"), getAllMeetings);
router.post("/meetings", protect, authorize("admin"), createMeeting);
router.put("/meetings/:id", protect, authorize("admin"), updateMeeting);
router.delete("/meetings/:id", protect, authorize("admin"), deleteMeeting);

// Notifications
router.get("/notifications", protect, authorize("admin"), getAllNotifications);
router.post("/notifications", protect, authorize("admin"), createNotification);

// Defense Alerts
router.get("/defense-alerts", protect, authorize("admin"), getAllDefenseAlerts);
router.post("/defense-alerts", protect, authorize("admin"), createDefenseAlert);
router.put("/defense-alerts/:id", protect, authorize("admin"), updateDefenseAlert);

// CSV Import
router.post("/import/csv", protect, authorize("admin"), upload.single("csv"), importCSV);

// Internship Timeline (supports multiple, non-overwriting records)
router.get("/timeline", protect, authorize("admin"), listTimelines);
router.post("/timeline", protect, authorize("admin"), createTimeline);
router.put("/timeline/:id", protect, authorize("admin"), updateTimeline);
router.delete("/timeline/:id", protect, authorize("admin"), deleteTimeline);

export default router;
