import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import { DataTypes } from "sequelize";

import { connectDB, sequelize } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import passwordRoutes from "./routes/passwordRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import association from "./models/association.js";
import studentRoutes from "./routes/studentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import supervisorRoutes from "./routes/supervisorRoutes.js";
import supervisorTaskRoutes from "./routes/supervisorTaskRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import timelineRoutes from "./routes/timelineRoutes.js";

const app = express();

// Earlier database versions predate the task submission and feedback fields.
// `sync({ force: false })` does not add those fields to an existing table, so
// bring that table forward safely when the server starts.
const ensureTaskColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Tasks");
  const missingColumns = {
    submittedAt: { type: DataTypes.DATE, allowNull: true },
    submissionNote: { type: DataTypes.TEXT, allowNull: true },
    feedback: { type: DataTypes.TEXT, allowNull: true },
    feedbackAt: { type: DataTypes.DATE, allowNull: true },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Tasks", name, definition);
      console.log(`Added missing Tasks.${name} column`);
    }
  }
};

// The Internship grade fields were added after the table was first created.
// sync({ force: false }) does not add new columns to an existing table, so
// bring those columns forward safely when the server starts.
const ensureInternshipColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Internships");
  const missingColumns = {
    finalGrade: { type: DataTypes.FLOAT, allowNull: true },
    gradeBreakdown: { type: DataTypes.JSON, allowNull: true },
    gradeStatus: { type: DataTypes.ENUM("pending", "submitted"), allowNull: false, defaultValue: "pending" },
    gradeSubmittedAt: { type: DataTypes.DATE, allowNull: true },
    gradeSubmittedBy: { type: DataTypes.INTEGER, allowNull: true },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Internships", name, definition);
      console.log(`Added missing Internships.${name} column`);
    }
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/test", testRoutes);
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/users", authRoutes);
app.use("/api/users", passwordRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/supervisor", supervisorRoutes);
app.use("/api/supervisor", supervisorTaskRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/timeline", timelineRoutes);

app.listen(3000, async () => {
  try {
    await connectDB();

    await ensureTaskColumns();
    await ensureInternshipColumns();

    await sequelize.sync({
      force: false
    });

    console.log("Server is running on port 3000");
  } catch (error) {
    console.error("Server startup error:", error);
  }
});
