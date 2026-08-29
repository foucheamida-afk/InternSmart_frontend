import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  getMyInterns,
  getSupervisorMeetings,
  createSupervisorMeeting,
  updateSupervisorMeeting,
  deleteSupervisorMeeting,
  getSupervisorNotifications,
  markSupervisorNotificationRead,
  getSupervisorReports,
  submitReportFeedback,
  getFinalGrade,
  submitFinalGrade,
} from "../controllers/supervisorController.js";

const router = express.Router();

// Interns
router.get("/my-interns", protect, authorize("academic_supervisor"), getMyInterns);

// Meetings
router.get("/meetings", protect, authorize("academic_supervisor"), getSupervisorMeetings);
router.post("/meetings", protect, authorize("academic_supervisor"), createSupervisorMeeting);
router.put("/meetings/:id", protect, authorize("academic_supervisor"), updateSupervisorMeeting);
router.delete("/meetings/:id", protect, authorize("academic_supervisor"), deleteSupervisorMeeting);

// Notifications
router.get("/notifications", protect, authorize("academic_supervisor"), getSupervisorNotifications);
router.put("/notifications/:id/read", protect, authorize("academic_supervisor"), markSupervisorNotificationRead);

// Reports
router.get("/reports", protect, authorize("academic_supervisor"), getSupervisorReports);
router.put("/reports/:id/feedback", protect, authorize("academic_supervisor"), submitReportFeedback);

// Final grades
router.get("/interns/:studentId/grade", protect, authorize("academic_supervisor"), getFinalGrade);
router.post("/interns/:studentId/grade", protect, authorize("academic_supervisor"), submitFinalGrade);

export default router;
