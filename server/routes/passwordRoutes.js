import express from "express";
import changePassword from "../controllers/passwordController.js";
import forgotPassword from "../controllers/passwordController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.put(
  "/change-password",
  protect,
  changePassword
);

router.post(
  "/forgot-password",
  forgotPassword
);

export default router;