import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  getSupervisorTasks,
  createTask,
  updateTask,
  deleteTask,
  submitTaskFeedback,
} from "../controllers/supervisorTaskController.js";

const router = express.Router();

router.get("/tasks", protect, authorize("academic_supervisor"), getSupervisorTasks);
router.post("/tasks", protect, authorize("academic_supervisor"), createTask);
router.put("/tasks/:id", protect, authorize("academic_supervisor"), updateTask);
router.delete("/tasks/:id", protect, authorize("academic_supervisor"), deleteTask);
router.put("/tasks/:id/feedback", protect, authorize("academic_supervisor"), submitTaskFeedback);

export default router;
