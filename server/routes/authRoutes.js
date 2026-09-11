import express from "express";
import { login, logout } from "../controllers/authController.js";
import { getUserById } from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", protect, logout);
router.get("/:id", protect, authorize("admin"), getUserById);

export default router;