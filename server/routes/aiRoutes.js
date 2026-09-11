import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import protect from "../middleware/authMiddleware.js";
import { getWritingAssistantQuota, reviewReport, writingAssistant } from "../controllers/aiController.js";

const router = express.Router();

// Both routes protected — the client sends a JWT Bearer token
router.post(
  "/review",
  protect,
  upload.single("report"),
  reviewReport
);

router.post(
  "/review-report",
  protect,
  upload.single("report"),
  reviewReport
);

router.post("/writing-assistant", protect, writingAssistant);
router.get("/writing-assistant/quota", protect, getWritingAssistantQuota);

export default router;