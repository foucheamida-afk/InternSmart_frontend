import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  getPendingReviews,
  getReviewDetail,
  approveReview,
  rejectReview,
} from "../controllers/reviewController.js";

const router = express.Router();

// Both supervisor capacities share this queue: the review row carries the
// capacity, so a dual-role supervisor sees academic and professional requests in
// one list and each verdict is attributed correctly.
//
// `authorize` also enforces the profile-onboarding gate, so a supervisor
// provisioned on demand cannot act on a report before confirming their profile.
const supervisorOnly = authorize("academic_supervisor", "professional_supervisor");

// Registered before "/:id" so "pending" is not read as a review id.
router.get("/pending", protect, supervisorOnly, getPendingReviews);
router.get("/:id", protect, supervisorOnly, getReviewDetail);
router.post("/:id/approve", protect, supervisorOnly, approveReview);
router.post("/:id/reject", protect, supervisorOnly, rejectReview);

export default router;
