import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  requestReportAnalysis,
  getReportAnalysis,
  getAnalysisJob,
  getProviders,
  providerWebhook,
} from "../controllers/plagiarismController.js";

const router = express.Router();

// Provider callbacks. Registered FIRST and deliberately without `protect`:
// Copyleaks cannot present a bearer token. The endpoint authenticates the caller
// by a shared secret in the URL it was handed at submission time, and refuses to
// operate at all when that secret is unset.
//
// `:status` is the `{STATUS}` placeholder Copyleaks replaces with one of
// completed / error / creditsChecked / indexed, so a single route serves every
// scan event.
router.post("/webhook/:status", providerWebhook);

const anyAuthenticatedRole = authorize(
  "student",
  "academic_supervisor",
  "professional_supervisor",
  "admin"
);

// Admin-only: reports which providers this deployment can actually use, and why
// the others cannot. Never returns credentials.
router.get("/providers", protect, authorize("admin"), getProviders);

router.post("/reports/:reportId/analyze", protect, anyAuthenticatedRole, requestReportAnalysis);
router.get("/reports/:reportId/latest", protect, anyAuthenticatedRole, getReportAnalysis);
router.get("/jobs/:jobId", protect, anyAuthenticatedRole, getAnalysisJob);

export default router;
