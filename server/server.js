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
import professionalSupervisorRoutes from "./routes/professionalSupervisorRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import timelineRoutes from "./routes/timelineRoutes.js";
import reportWorkspaceRoutes from "./routes/reportWorkspaceRoutes.js";
import { verifyEmailConnection } from "./utils/sendEmail.js";

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

const ensureReportWorkspaceColumn = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Reports");
  if (!columns.documentContent) {
    await queryInterface.addColumn("Reports", "documentContent", { type: DataTypes.JSON, allowNull: true });
    console.log("Added Reports.documentContent column");
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

// The professionalSupervisorId column was added after the Internships table was first created.
// sync({ force: false }) does not add new columns to an existing table, so
// bring that column forward safely when the server starts.
const ensureInternshipProfessionalSupervisorColumn = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Internships");
  if (!columns.professionalSupervisorId) {
    await queryInterface.addColumn("Internships", "professionalSupervisorId", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    console.log("Added missing Internships.professionalSupervisorId column");
  }
};

// The Meeting table may need group meeting columns added.
const ensureMeetingGroupColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Meetings");
  if (!columns.studentIds) {
    await queryInterface.addColumn("Meetings", "studentIds", {
      type: DataTypes.JSON,
      allowNull: true,
    });
    console.log("Added missing Meetings.studentIds column");
  }
  if (!columns.isGroupMeeting) {
    await queryInterface.addColumn("Meetings", "isGroupMeeting", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    console.log("Added missing Meetings.isGroupMeeting column");
  }
};

// The Task table may need separate feedback columns for academic and professional supervisors.
const ensureTaskFeedbackColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Tasks");
  const missingColumns = {
    feedbackAcademic: { type: DataTypes.TEXT, allowNull: true },
    feedbackAcademicAt: { type: DataTypes.DATE, allowNull: true },
    feedbackAcademicBy: { type: DataTypes.INTEGER, allowNull: true },
    feedbackProfessional: { type: DataTypes.TEXT, allowNull: true },
    feedbackProfessionalAt: { type: DataTypes.DATE, allowNull: true },
    feedbackProfessionalBy: { type: DataTypes.INTEGER, allowNull: true },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Tasks", name, definition);
      console.log(`Added missing Tasks.${name} column`);
    }
  }
};

// The Internship table may need separate grade columns for academic and professional supervisors.
const ensureInternshipGradeColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Internships");
  const missingColumns = {
    academicGrade: { type: DataTypes.FLOAT, allowNull: true },
    academicGradeBreakdown: { type: DataTypes.JSON, allowNull: true },
    academicGradeStatus: {
      type: DataTypes.ENUM("pending", "submitted"),
      allowNull: false,
      defaultValue: "pending",
    },
    academicGradeSubmittedAt: { type: DataTypes.DATE, allowNull: true },
    academicGradeSubmittedBy: { type: DataTypes.INTEGER, allowNull: true },
    professionalGrade: { type: DataTypes.FLOAT, allowNull: true },
    professionalGradeBreakdown: { type: DataTypes.JSON, allowNull: true },
    professionalGradeStatus: {
      type: DataTypes.ENUM("pending", "submitted"),
      allowNull: false,
      defaultValue: "pending",
    },
    professionalGradeSubmittedAt: { type: DataTypes.DATE, allowNull: true },
    professionalGradeSubmittedBy: { type: DataTypes.INTEGER, allowNull: true },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Internships", name, definition);
      console.log(`Added missing Internships.${name} column`);
    }
  }
};
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
app.use("/api/professional-supervisor", professionalSupervisorRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/workspace", reportWorkspaceRoutes);

app.listen(3000, async () => {
  try {
    await connectDB();

    await ensureTaskColumns();
    await ensureReportWorkspaceColumn();
    await ensureInternshipColumns();
    await ensureInternshipProfessionalSupervisorColumn();
    await ensureMeetingGroupColumns();
    await ensureTaskFeedbackColumns();
    await ensureInternshipGradeColumns();

    await sequelize.sync({
      force: false
    });

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailFrom = process.env.EMAIL_FROM;
    if (!emailUser || !emailPass || !emailFrom) {
      console.warn("EMAIL NOT CONFIGURED: Set EMAIL_USER, EMAIL_PASS, and EMAIL_FROM in server/.env to enable account emails.");
    } else {
      try {
        await verifyEmailConnection();
        console.log("Email service connected successfully.");
      } catch (emailError) {
        console.error("EMAIL CONNECTION FAILED:", emailError.message);
      }
    }

    console.log("Server is running on port 3000");
  } catch (error) {
    console.error("Server startup error:", error);
  }
});
