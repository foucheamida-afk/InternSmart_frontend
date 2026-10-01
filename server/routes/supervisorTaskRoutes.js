import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  getSupervisorTasks,
  createTask,
  updateTask,
  reviewTaskSubmission,
  deleteTask,
  submitTaskFeedback,
} from "../controllers/supervisorTaskController.js";

const router = express.Router();
const supervisorOnly = authorize("academic_supervisor", "professional_supervisor");

router.get("/tasks", protect, supervisorOnly, getSupervisorTasks);
router.post("/tasks", protect, supervisorOnly, createTask);
router.put("/tasks/:id", protect, supervisorOnly, updateTask);
router.put("/tasks/:id/review", protect, supervisorOnly, reviewTaskSubmission);
router.delete("/tasks/:id", protect, supervisorOnly, deleteTask);
router.put("/tasks/:id/feedback", protect, supervisorOnly, submitTaskFeedback);

export default router;
