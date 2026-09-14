import express from "express";
// NOTE: these must be NAMED imports. This file previously default-imported the
// controller twice under two names, but passwordController.js's default export is
// `changePassword`, so POST /forgot-password was silently routed to the
// change-password handler and failed on an undefined req.user.id.
import {
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from "../controllers/passwordController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.put(
  "/change-password",
  protect,
  changePassword
);

// Password recovery (OTP flow). All public by necessity - the caller is locked out.
router.post(
  "/forgot-password",
  forgotPassword
);

router.post(
  "/verify-otp",
  verifyOtp
);

router.post(
  "/reset-password",
  resetPassword
);

export default router;
