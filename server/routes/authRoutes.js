import express from "express";
import { login, logout } from "../controllers/authController.js";
import {
  getUserById,
  getMyProfile,
  completeOnboarding,
} from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", protect, logout);

// Registered BEFORE "/:id" so that "/me" is not captured by the admin lookup
// and answered with a 404 for id = "me".
//
// These two carry `protect` but deliberately no role guard: the role guard is
// what enforces the onboarding gate, so guarding the endpoint that lifts the
// gate would deadlock a supervisor who has not onboarded yet.
router.get("/me", protect, getMyProfile);
router.put("/me/onboarding", protect, completeOnboarding);

router.get("/:id", protect, authorize("admin"), getUserById);

export default router;
