import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import { getWritingAssistantQuota, reviewReport, writingAssistant } from "../controllers/aiController.js";

const router = express.Router();

// These routes were previously `protect`-only, so ANY authenticated account could
// spend AI requests - and because the quota is attached to a Student row, a
// non-student caller was never even charged for them (NFR-SEC-03). Restricting to
// the roles that actually have an AI surface in the client (students and both
// supervisor types; admins have no AI page) closes that hole.
const aiRoles = authorize("student", "academic_supervisor", "professional_supervisor");

router.post(
  "/review",
  protect,
  aiRoles,
  upload.single("report"),
  reviewReport
);

router.post(
  "/review-report",
  protect,
  aiRoles,
  upload.single("report"),
  reviewReport
);

router.post("/writing-assistant", protect, aiRoles, writingAssistant);
router.get("/writing-assistant/quota", protect, aiRoles, getWritingAssistantQuota);

export default router;
