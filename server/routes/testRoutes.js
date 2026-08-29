import express from "express";
import protect from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get(
  "/student",
  protect,
  authorize("student"),
  (req, res) => {
    res.json({
      message: "Welcome Student",
      user: req.user
    });
  }
);

router.get(
  "/academic-supervisor",
  protect,
  authorize("academic_supervisor"),
  (req, res) => {
    res.json({
      message: "Welcome Academic Supervisor",
      user: req.user
    });
  }
);

router.get(
  "/admin",
  protect,
  authorize("admin"),
  (req, res) => {
    res.json({
      message: "Welcome Admin",
      user: req.user
    });
  }
);

export default router;