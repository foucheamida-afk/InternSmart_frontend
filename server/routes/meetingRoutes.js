import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  scheduleMeeting,
  getSupervisorMeetingsList,
  updateMeeting,
  deleteMeeting,
  initiateMeeting,
  getStudentMeetings,
} from "../controllers/meetingController.js";

const router = express.Router();

// Supervisor routes
router.post("/schedule", protect, authorize("academic_supervisor"), scheduleMeeting);
router.get("/supervisor", protect, authorize("academic_supervisor"), getSupervisorMeetingsList);
router.put("/:id", protect, authorize("academic_supervisor"), updateMeeting);
router.delete("/:id", protect, authorize("academic_supervisor"), deleteMeeting);
router.put("/:id/initiate", protect, authorize("academic_supervisor"), initiateMeeting);

// Student routes
router.get("/student", protect, getStudentMeetings);

export default router;
