import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getPublicTimeline } from "../controllers/timelineController.js";

const router = express.Router();

// Visible to any authenticated student or supervisor
router.get("/", protect, getPublicTimeline);

export default router;
