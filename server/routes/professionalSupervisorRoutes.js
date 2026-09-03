import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  getMyInterns,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  submitTaskFeedback,
  getStats,
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  initiateMeeting,
  getFinalGrade,
  submitFinalGrade,
} from "../controllers/professionalSupervisorController.js";

const router = express.Router();

// Interns
router.get("/my-interns", protect, authorize("professional_supervisor"), getMyInterns);

// Tasks
router.get("/tasks", protect, authorize("professional_supervisor"), getTasks);
router.post("/tasks", protect, authorize("professional_supervisor"), createTask);
router.put("/tasks/:id", protect, authorize("professional_supervisor"), updateTask);
router.delete("/tasks/:id", protect, authorize("professional_supervisor"), deleteTask);
router.put("/tasks/:id/feedback", protect, authorize("professional_supervisor"), submitTaskFeedback);

// Meetings
router.get("/meetings", protect, authorize("professional_supervisor"), getMeetings);
router.post("/meetings", protect, authorize("professional_supervisor"), createMeeting);
router.put("/meetings/:id", protect, authorize("professional_supervisor"), updateMeeting);
router.delete("/meetings/:id", protect, authorize("professional_supervisor"), deleteMeeting);
router.put("/meetings/:id/initiate", protect, authorize("professional_supervisor"), initiateMeeting);

// Grades
router.get("/interns/:studentId/grade", protect, authorize("professional_supervisor"), getFinalGrade);
router.post("/interns/:studentId/grade", protect, authorize("professional_supervisor"), submitFinalGrade);

// Stats
router.get("/stats", protect, authorize("professional_supervisor"), getStats);

export default router;
