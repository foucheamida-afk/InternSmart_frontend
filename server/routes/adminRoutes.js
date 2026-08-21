import express from "express";
import createStudent from "../controllers/adminController.js";

const router = express.Router();

router.post("/students", createStudent);

export default router;