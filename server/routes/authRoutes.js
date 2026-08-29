import express from "express";
import login from "../controllers/authController.js";
import { getUserById } from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/:id", protect, getUserById);

export default router;