import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import { addReportComment, getReportWorkspace, saveReportWorkspace, deleteReportComment } from "../controllers/reportWorkspaceController.js";

const router = express.Router();
const workspaceRoles = authorize("student", "academic_supervisor", "professional_supervisor");

router.get("/reports/:id/workspace", protect, workspaceRoles, getReportWorkspace);
router.put("/reports/:id/workspace", protect, authorize("student"), saveReportWorkspace);
router.post("/reports/:id/comments", protect, authorize("academic_supervisor", "professional_supervisor"), addReportComment);
router.delete("/reports/:id/comments/:commentId", protect, authorize("academic_supervisor", "professional_supervisor"), deleteReportComment);

export default router;
