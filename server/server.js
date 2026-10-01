import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import { DataTypes } from "sequelize";
import aiRoutes from "./routes/aiRoutes.js";

import { connectDB, sequelize } from "./config/db.js";
import { WORKSPACE_JSON_LIMIT } from "./config/requestLimits.js";

import authRoutes from "./routes/authRoutes.js";
import passwordRoutes from "./routes/passwordRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import association from "./models/association.js";
import { REPORT_STATUSES } from "./models/reportModel.js";
import { REVIEW_STATUSES } from "./models/reportReviewModel.js";
import studentRoutes from "./routes/studentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import supervisorRoutes from "./routes/supervisorRoutes.js";
import supervisorTaskRoutes from "./routes/supervisorTaskRoutes.js";
import professionalSupervisorRoutes from "./routes/professionalSupervisorRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import timelineRoutes from "./routes/timelineRoutes.js";
import reportWorkspaceRoutes from "./routes/reportWorkspaceRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import libraryRoutes from "./routes/libraryRoutes.js";
import plagiarismRoutes from "./routes/plagiarismRoutes.js";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import User from "./models/userModel.js";
import Student from "./models/studentModel.js";
import Internship from "./models/studentAssignmentModel.js";
import ReportPlagiarismIndex from "./models/reportPlagiarismIndexModel.js";
import { startPlagiarismWorker } from "./jobs/plagiarismWorker.js";

const describeTableSafe = async (tableName) => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    return await queryInterface.describeTable(tableName);
  } catch (err) {
    return null;
  }
};

const safeSyncUserTable = async () => {
  try {
    await User.sync();
    console.log("Users table synchronized successfully.");
  } catch (error) {
    const isTableExists =
      error.original?.code === "ER_TABLE_EXISTS_ERROR" ||
      error.parent?.code === "ER_TABLE_EXISTS_ERROR" ||
      String(error.message).includes("already exists");

    if (isTableExists) {
      console.log("Users table is already present in database.");
      return;
    }

    const isTablespaceErr =
      error.original?.code === "ER_TABLESPACE_EXISTS" ||
      error.parent?.code === "ER_TABLESPACE_EXISTS" ||
      String(error.message).includes("1813") ||
      String(error.message).includes("Tablespace");

    if (isTablespaceErr) {
      console.warn("Detected orphaned MySQL tablespace (ER_TABLESPACE_EXISTS). Attempting cleanup...");

      await sequelize.query("DROP TABLE IF EXISTS `Users`").catch(() => {});
      await sequelize.query("DROP TABLE IF EXISTS `users`").catch(() => {});

      const possibleDataDirs = [
        "C:\\xampp\\mysql\\data\\internsmart",
        "C:\\xampp\\mysql\\data\\internSmart",
      ];

      for (const dataDir of possibleDataDirs) {
        if (fs.existsSync(dataDir)) {
          const files = ["users.ibd", "Users.ibd", "users.frm", "Users.frm"];
          for (const f of files) {
            const filePath = path.join(dataDir, f);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
                console.log(`Removed orphaned tablespace file: ${filePath}`);
              } catch (unlinkErr) {
                console.warn(`Could not remove ${filePath} while MySQL is running:`, unlinkErr.message);
              }
            }
          }
        }
      }

      try {
        await User.sync();
        console.log("Successfully synchronized Users table after clearing tablespace.");
      } catch (retryErr) {
        if (
          retryErr.original?.code === "ER_TABLE_EXISTS_ERROR" ||
          retryErr.parent?.code === "ER_TABLE_EXISTS_ERROR" ||
          String(retryErr.message).includes("already exists")
        ) {
          console.log("Users table is already present in database.");
          return;
        }
        console.error("\n==========================================================");
        console.error("MYSQL TABLESPACE ERROR (ER_TABLESPACE_EXISTS / Error 1813)");
        console.error("An orphaned 'users.ibd' file exists in your XAMPP MySQL folder.");
        console.error("To fix this in 10 seconds:");
        console.error("1. In XAMPP Control Panel, click STOP on MySQL.");
        console.error("2. Delete the file: C:\\xampp\\mysql\\data\\internsmart\\users.ibd");
        console.error("3. In XAMPP Control Panel, click START on MySQL.");
        console.error("4. Restart the server with 'npm run dev'.");
        console.error("==========================================================\n");
      }
    } else {
      console.error("User.sync() error:", error.message);
    }
  }
};

const ensureDefaultUsers = async () => {
  try {
    await safeSyncUserTable();

    const hashedPassword = await bcrypt.hash("Pass1234!", 10);
    const adminHashedPassword = await bcrypt.hash("dady12345", 10);

    // 1. Ensure Admin
    const adminCount = await User.count({ where: { role: "admin" } });
    if (adminCount === 0) {
      const email = "foucheamida@gmail.com";
      await User.create({
        name: "System Administrator",
        email,
        password: adminHashedPassword,
        role: "admin",
        mustChangePassword: false,
        active: true,
      });
      console.log(`Default admin account seeded: ${email} (password: dady12345)`);
    }

    // 2. Ensure Student Users for imported Students table
    const students = await Student.findAll().catch(() => []);
    for (const student of students) {
      if (!student.userId) continue;
      const existingUser = await User.findByPk(student.userId);
      if (!existingUser) {
        const studentEmail = `student${student.id}@internsmart.com`;
        const matriculeNum = student.matricule || `STU${student.id}`;
        await User.create({
          id: student.userId,
          name: `Student (${matriculeNum})`,
          email: studentEmail,
          password: hashedPassword,
          role: "student",
          mustChangePassword: false,
          active: true,
          status: "logged_out",
        });
        console.log(`Re-created Student User ID ${student.userId}: ${studentEmail} (password: Pass1234!)`);
      }
    }

    // 3. Ensure Academic and Professional Supervisors for imported Internships table
    const internships = await Internship.findAll().catch(() => []);
    for (const internship of internships) {
      if (internship.academicSupervisorId) {
        const existingAcad = await User.findByPk(internship.academicSupervisorId);
        if (!existingAcad) {
          const email = `academic.sup${internship.academicSupervisorId}@internsmart.com`;
          await User.create({
            id: internship.academicSupervisorId,
            name: `Academic Supervisor ${internship.academicSupervisorId}`,
            email,
            password: hashedPassword,
            role: "academic_supervisor",
            mustChangePassword: false,
            active: true,
            status: "logged_out",
            onboardingCompletedAt: new Date(),
          });
          console.log(`Re-created Academic Supervisor User ID ${internship.academicSupervisorId}: ${email}`);
        }
      }

      if (internship.professionalSupervisorId) {
        const existingProf = await User.findByPk(internship.professionalSupervisorId);
        if (!existingProf) {
          const email = internship.professionalSupervisorId === 12 ? "kapnang@gmail.com" : `prof.sup${internship.professionalSupervisorId}@internsmart.com`;
          const name = internship.professionalSupervisorId === 12 ? "Kapnang Rufus" : `Professional Supervisor ${internship.professionalSupervisorId}`;
          await User.create({
            id: internship.professionalSupervisorId,
            name,
            email,
            password: hashedPassword,
            role: "professional_supervisor",
            mustChangePassword: false,
            active: true,
            status: "logged_out",
            onboardingCompletedAt: new Date(),
          });
          console.log(`Re-created Professional Supervisor User ID ${internship.professionalSupervisorId}: ${email}`);
        }
      }
    }
  } catch (err) {
    console.warn("Could not auto-restore users:", err.message);
  }
};
import {
  errorEnvelope,
  notFoundHandler,
  errorHandler,
} from "./middleware/responseEnvelope.js";
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

const ensureReportAiColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Reports");
  if (!columns.aiAnalysis) {
    await queryInterface.addColumn("Reports", "aiAnalysis", { type: DataTypes.JSON, allowNull: true });
    console.log("Added Reports.aiAnalysis column");
  }
  if (!columns.aiScore) {
    await queryInterface.addColumn("Reports", "aiScore", { type: DataTypes.FLOAT, allowNull: true });
    console.log("Added Reports.aiScore column");
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
    supervisorRole: { type: DataTypes.STRING, allowNull: true },
    milestones: { type: DataTypes.JSON, allowNull: true },
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
const ensureUserStatusColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await describeTableSafe("Users");
  if (!columns) return;
  const missingColumns = {
    mustChangePassword: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: {
      type: DataTypes.ENUM("online", "offline", "logged_in", "logged_out", "deactivated"),
      allowNull: false,
      defaultValue: "logged_out",
    },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true },
    lastLogoutAt: { type: DataTypes.DATE, allowNull: true },
    deactivatedAt: { type: DataTypes.DATE, allowNull: true },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Users", name, definition);
      console.log(`Added missing Users.${name} column`);
    }
  }

  await sequelize.query(
    "ALTER TABLE Users MODIFY COLUMN status ENUM('online', 'offline', 'logged_in', 'logged_out', 'deactivated') NOT NULL DEFAULT 'logged_out'"
  ).catch((err) => console.warn("Could not alter Users.status ENUM:", err.message));

  await sequelize.query("UPDATE Users SET active = 1 WHERE active IS NULL;").catch(() => {});
};

// The password-reset OTP columns were added after the Users table was first created.
const ensureUserOtpColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await describeTableSafe("Users");
  if (!columns) return;
  const missingColumns = {
    otpCode: { type: DataTypes.STRING, allowNull: true },
    otpExpires: { type: DataTypes.DATE, allowNull: true },
    otpAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Users", name, definition);
      console.log(`Added missing Users.${name} column`);
    }
  }
};

// Supervisor onboarding columns, added after the Users table was first created.
const ensureUserOnboardingColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await describeTableSafe("Users");
  if (!columns) return;

  const missingColumns = {
    phone: { type: DataTypes.STRING, allowNull: true },
    organisation: { type: DataTypes.STRING, allowNull: true },
    jobTitle: { type: DataTypes.STRING, allowNull: true },
    onboardingCompletedAt: { type: DataTypes.DATE, allowNull: true },
  };

  const introducedByThisBoot = !columns.onboardingCompletedAt;

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Users", name, definition);
      console.log(`Added missing Users.${name} column`);
    }
  }

  if (introducedByThisBoot) {
    // Every supervisor account in existence at this point predates the
    // onboarding gate, so treat them as already onboarded. Without this, adding
    // the feature would instantly lock every existing supervisor out of their
    // dashboard.
    await sequelize.query(
      `UPDATE Users
          SET onboardingCompletedAt = COALESCE(createdAt, NOW())
        WHERE onboardingCompletedAt IS NULL
          AND role IN ('academic_supervisor', 'professional_supervisor')`
    );
    console.log("Backfilled onboardingCompletedAt for pre-existing supervisor accounts");
  }
};

// The two-stage report submission workflow needs its lifecycle statuses and
// bookkeeping columns on an already-populated Reports table.
//
// The ENUM is *extended*, never replaced: the six legacy statuses are still on
// existing rows and the admin dashboard counts several of them
// (`submitted`/`in_review`/`ai_analysis` as pending, `needs_revision` as
// revision-requested). Narrowing the ENUM would either fail against that data or
// silently rewrite it.
const ensureReportWorkflowColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Reports");

  const missingColumns = {
    currentVersionId: { type: DataTypes.INTEGER, allowNull: true },
    reviewCycle: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    submissionRequestedAt: { type: DataTypes.DATE, allowNull: true },
    finalSubmittedAt: { type: DataTypes.DATE, allowNull: true },
    lockedAt: { type: DataTypes.DATE, allowNull: true },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Reports", name, definition);
      console.log(`Added missing Reports.${name} column`);
    }
  }

  // Widen the status ENUM to the full lifecycle. Idempotent, so it is safe to
  // issue on every boot.
  await sequelize.query(
    `ALTER TABLE Reports MODIFY COLUMN status ENUM(${REPORT_STATUSES.map((s) => `'${s}'`).join(", ")}) NOT NULL DEFAULT 'submitted'`
  );

  // The review verdict ENUM gained `cancelled` (set on the sibling review when
  // the other supervisor rejects).
  const reviewColumns = await queryInterface.describeTable("ReportReviews");
  if (reviewColumns.status) {
    await sequelize.query(
      `ALTER TABLE ReportReviews MODIFY COLUMN status ENUM(${REVIEW_STATUSES.map((s) => `'${s}'`).join(", ")}) NOT NULL DEFAULT 'pending'`
    );
  }

  // Approval is now gated on the existing Internship rubric grade, so the review
  // records the grade it was based on.
  if (!reviewColumns.gradeSnapshot) {
    await queryInterface.addColumn("ReportReviews", "gradeSnapshot", { type: DataTypes.JSON, allowNull: true });
    console.log("Added missing ReportReviews.gradeSnapshot column");
  }

  // `privateMark` was dropped: the product decision is that a supervisor's
  // report approval IS the existing rubric grade (academic /20, professional
  // /10), so a second confidential mark on the same supervisor-student pair
  // would duplicate grading. The column was never written to, so dropping it
  // loses nothing - and leaving it would be dead schema contradicting the
  // decision.
  if (reviewColumns.privateMark) {
    await queryInterface.removeColumn("ReportReviews", "privateMark");
    console.log("Dropped ReportReviews.privateMark (approval now reuses the rubric grade)");
  }

  // Backfill one version row per existing report so the workflow has something
  // to bind approvals to. `extractedText` is deliberately left NULL rather than
  // copied from `documentContent`: that column holds a structured editor tree,
  // not plain text, and presenting it as the engine's input would be a lie. The
  // phase-4 engine extracts from the stored file instead.
  //
  // Guarded by NOT EXISTS, so it creates a row only for a report that has none
  // and can run on every boot.
  const [[{ pending: pendingVersions }]] = await sequelize.query(
    `SELECT COUNT(*) AS pending
       FROM Reports r
      WHERE NOT EXISTS (SELECT 1 FROM ReportVersions v WHERE v.reportId = r.id)`
  );

  if (Number(pendingVersions) > 0) {
    await sequelize.query(
      `INSERT INTO ReportVersions (reportId, versionNumber, fileName, fileUrl, uploadedBy, createdAt, updatedAt)
       SELECT r.id, COALESCE(r.version, 1), r.fileName, r.fileUrl, NULL, COALESCE(r.submittedAt, NOW()), NOW()
         FROM Reports r
        WHERE NOT EXISTS (SELECT 1 FROM ReportVersions v WHERE v.reportId = r.id)`
    );
    console.log(`Backfilled ReportVersions for ${pendingVersions} existing report(s)`);
  }

  // Point each report at its newest version if it is not already linked.
  await sequelize.query(
    `UPDATE Reports r
        SET r.currentVersionId = (
              SELECT v.id FROM ReportVersions v
               WHERE v.reportId = r.id
               ORDER BY v.versionNumber DESC LIMIT 1
            )
      WHERE r.currentVersionId IS NULL`
  );
};

// Internship cohort metadata, added for the virtual library (phase 3).
const ensureInternshipAcademicYearColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Internships");

  const missingColumns = {
    academicYear: { type: DataTypes.STRING, allowNull: true },
    program: { type: DataTypes.STRING, allowNull: true },
    internshipDomain: { type: DataTypes.STRING, allowNull: true },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("Internships", name, definition);
      console.log(`Added missing Internships.${name} column`);
    }
  }
};

// Migration for dedicated ReportPlagiarismIndex table and removal of legacy columns.
const ensureLibraryCorpusColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();

  // 1. Ensure table exists
  await ReportPlagiarismIndex.sync();

  // 2. Check if legacy columns exist on LibraryEntries and migrate data
  const libraryColumns = await queryInterface.describeTable("LibraryEntries");
  if (libraryColumns.corpusSignature || libraryColumns.corpusShingles) {
    try {
      const [legacyEntries] = await sequelize.query(`
        SELECT id, reportVersionId, corpusSignature, corpusShingles, corpusWordCount, corpusAlgorithmVersion, corpusIndexedAt
        FROM LibraryEntries
        WHERE corpusSignature IS NOT NULL OR corpusShingles IS NOT NULL
      `);

      for (const entry of legacyEntries) {
        if (!entry.reportVersionId) continue;
        const existingIndex = await ReportPlagiarismIndex.findOne({
          where: { reportVersionId: entry.reportVersionId },
        });

        if (!existingIndex) {
          await ReportPlagiarismIndex.create({
            reportVersionId: entry.reportVersionId,
            libraryEntryId: entry.id,
            corpusSignature: typeof entry.corpusSignature === "string" ? JSON.parse(entry.corpusSignature) : entry.corpusSignature,
            corpusShingles: typeof entry.corpusShingles === "string" ? JSON.parse(entry.corpusShingles) : entry.corpusShingles,
            corpusWordCount: entry.corpusWordCount,
            algorithmVersion: entry.corpusAlgorithmVersion || "v1",
            indexedAt: entry.corpusIndexedAt || new Date(),
          });
        }
      }
      if (legacyEntries.length > 0) {
        console.log(`Migrated ${legacyEntries.length} legacy plagiarism index rows to ReportPlagiarismIndexes.`);
      }
    } catch (err) {
      console.warn("Legacy plagiarism index migration warning:", err.message);
    }

    const toDrop = ["corpusSignature", "corpusShingles", "corpusWordCount", "corpusAlgorithmVersion", "corpusIndexedAt"];
    for (const col of toDrop) {
      if (libraryColumns[col]) {
        await queryInterface.removeColumn("LibraryEntries", col).catch((e) => console.warn(`Drop LibraryEntries.${col} warn:`, e.message));
        console.log(`Dropped legacy LibraryEntries.${col} column`);
      }
    }
  }

  // 3. Drop extractedText from ReportVersions if it exists
  const versionColumns = await queryInterface.describeTable("ReportVersions");
  if (versionColumns.extractedText) {
    await queryInterface.removeColumn("ReportVersions", "extractedText").catch((e) => console.warn("Drop ReportVersions.extractedText warn:", e.message));
    console.log("Dropped legacy ReportVersions.extractedText column");
  }
};

// Severity-band and exclusion bookkeeping on plagiarism analyses (phase 6).
const ensurePlagiarismBandColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("PlagiarismAnalyses");

  const missingColumns = {
    plagiarismStatus: { type: DataTypes.STRING, allowNull: true },
    excludedSections: { type: DataTypes.JSON, allowNull: true },
  };

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!columns[name]) {
      await queryInterface.addColumn("PlagiarismAnalyses", name, definition);
      console.log(`Added missing PlagiarismAnalyses.${name} column`);
    }
  }
};

const ensureStudentAiColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Students");
  if (!columns.aiRequestsToday) {
    await queryInterface.addColumn("Students", "aiRequestsToday", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    console.log("Added Students.aiRequestsToday column");
  }
  if (!columns.aiRequestsDate) {
    await queryInterface.addColumn("Students", "aiRequestsDate", { type: DataTypes.DATEONLY, allowNull: true });
    console.log("Added Students.aiRequestsDate column");
  }
};

const ensureNotificationColumns = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("Notifications");
  if (!columns.meetingLink) {
    await queryInterface.addColumn("Notifications", "meetingLink", { type: DataTypes.STRING, allowNull: true });
    console.log("Added Notifications.meetingLink column");
  }
};
app.use(cors());
// A whole editor document - the Word import/export body, and the autosave PUT
// that stores it - is far past express.json()'s 100 kB default once a report has
// pictures in it (6.5 MB for a real 100-page thesis). At the default, saves were
// rejected with a 413 the client could only show as "Offline - saved locally",
// i.e. edits silently stopped reaching the server.
// Scoped to /api/workspace so every other endpoint keeps the default; body-parser
// marks a request as parsed, so the global express.json() below then skips these.
// See config/requestLimits.js.
app.use("/api/workspace", express.json({ limit: WORKSPACE_JSON_LIMIT }));
app.use(express.json());

// Applied before any route, so every JSON response in the application carries the
// standard envelope without a single handler being rewritten (NFR-MNT-04). It is
// additive: `success` is filled in when absent and `error` is added to failures,
// while every field a handler already set - including the domain fields the
// clients read - is left exactly as it was.
app.use(errorEnvelope);

app.use("/api/test", testRoutes);
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/uploads", express.static(path.resolve(process.cwd(), "..", "uploads")));
app.use("/uploads", express.static(path.resolve(process.cwd(), "server", "uploads")));
app.use("/api/ai", aiRoutes);
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
app.use("/api/reviews", reviewRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/plagiarism", plagiarismRoutes);

// Last in the stack, deliberately: unmatched routes and thrown errors are the
// two cases no handler covers, and both previously produced an HTML body that a
// JSON client cannot parse.
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, async () => {
  try {
    await connectDB();

    // Create any missing tables FIRST. The ensure*Columns helpers below call
    // describeTable() on tables they assume already exist, so against a fresh
    // database they threw ("No description found for \"Tasks\" table") before
    // sync() ever ran and the server could not bootstrap at all. Running sync()
    // first is safe for existing databases too: with force:false it leaves
    // existing tables untouched, and the helpers still add any missing columns.
    try {
      await sequelize.sync({
        force: false
      });
    } catch (syncErr) {
      if (
        syncErr.original?.code === "ER_TABLE_EXISTS_ERROR" ||
        syncErr.parent?.code === "ER_TABLE_EXISTS_ERROR" ||
        String(syncErr.message).includes("already exists") ||
        syncErr.name === "SequelizeDatabaseError"
      ) {
        console.log("Database schema synchronized (existing tables preserved).");
      } else {
        throw syncErr;
      }
    }

    await safeSyncUserTable();

    await ensureTaskColumns();
    await ensureReportWorkspaceColumn();
    await ensureReportAiColumns();
    await ensureStudentAiColumns();
    await ensureNotificationColumns();
    await ensureInternshipColumns();
    await ensureInternshipProfessionalSupervisorColumn();
    await ensureMeetingGroupColumns();
    await ensureTaskFeedbackColumns();
    await ensureInternshipGradeColumns();
    await ensureUserStatusColumns();
    await ensureUserOtpColumns();
    await ensureUserOnboardingColumns();
    await ensureReportWorkflowColumns();
    await ensureInternshipAcademicYearColumns();
    await ensureLibraryCorpusColumns();
    await ensurePlagiarismBandColumns();

    await ensureDefaultUsers();

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

    console.log(`Server is running on port ${PORT}`);

    // Started after the listener so a slow Copyleaks call can never delay the
    // API accepting traffic.
    startPlagiarismWorker();
  } catch (error) {
    console.error("Server startup error:", error);
  }
});

export { app };