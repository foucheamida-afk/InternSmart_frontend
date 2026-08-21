import express from "express";
import changePassword from "../controllers/passwordController.js";

const router = express.Router();

router.put("/change-password", changePassword);

export default router;