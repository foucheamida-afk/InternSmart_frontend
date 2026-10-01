// Script to seed a historical report into the virtual library for plagiarism testing.
//
// Usage:
//   node scripts/seedHistoricalReport.js
//   node scripts/seedHistoricalReport.js "2023/2024" "Distributed Microservices Architecture"
import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import LibraryEntry from "../models/libraryEntryModel.js";
import { ensureIndexed } from "../services/plagiarism/internalProvider.js";

const academicYearArg = process.argv[2] || "2023/2024";
const titleArg = process.argv[3] || "Distributed Systems Telemetry Report";

const SAMPLE_PARAGRAPHS = [
  "The internship was carried out at the company research division where the primary objective involved designing and implementing a distributed telemetry pipeline capable of ingesting roughly forty thousand events per second while maintaining a bounded end to end latency budget across three availability zones.",
  "The pipeline was decomposed into an ingestion tier a normalisation tier and a durable append only storage tier. Each tier was independently scalable and communicated exclusively through a partitioned commit log which allowed replay of historical traffic for regression testing and deterministic reproduction of production incidents.",
  "Particular attention was paid to backpressure because unbounded queue growth during a downstream outage was identified as the dominant failure mode in the legacy system and a credit based flow control scheme was adopted.",
  "References",
  "1. Kleppmann M. (2017) Designing Data-Intensive Applications. O'Reilly Media.",
  "2. Kreps J. et al. (2011) Kafka: a Distributed Messaging System for Log Processing.",
];

const TREE = (paragraphs) => ({
  type: "doc",
  content: paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  })),
});

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database...");

    const tag = `seed_${Date.now()}`;
    const email = `archived_student_${tag}@example.invalid`;
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // 1. Create student user for the historical report
    const user = await User.create({
      name: `Archived Student (${academicYearArg})`,
      email,
      password: passwordHash,
      role: "student",
      mustChangePassword: false,
      active: true,
    });

    const student = await Student.create({
      userId: user.id,
      matricule: `HIST-${Date.now()}`,
      class: "Computer Science",
    });

    await Internship.create({
      studentId: student.id,
      company: "Acme Research Lab",
      academicYear: academicYearArg,
      program: "Computer Science",
      internshipDomain: "Distributed Systems",
    });

    // 2. Create historical report & version
    const report = await Report.create({
      studentId: student.id,
      title: titleArg,
      fileName: `${titleArg.replace(/\s+/g, "_")}.pdf`,
      fileUrl: `/uploads/${tag}.pdf`,
      status: "final_submitted",
      submittedAt: new Date(),
      documentContent: TREE(SAMPLE_PARAGRAPHS),
    });

    const version = await ReportVersion.create({
      reportId: report.id,
      versionNumber: 1,
      fileName: report.fileName,
      fileUrl: report.fileUrl,
      fileHash: `hash-${report.id}`,
    });

    await report.update({
      currentVersionId: version.id,
      lockedAt: new Date(),
      finalSubmittedAt: new Date(),
    });

    // 3. Create Virtual Library Entry
    const entry = await LibraryEntry.create({
      reportId: report.id,
      reportVersionId: version.id,
      studentId: student.id,
      title: report.title,
      abstract: SAMPLE_PARAGRAPHS[0],
      keywords: ["distributed systems", "telemetry", "kafka", "pipeline"],
      academicYear: academicYearArg,
      program: "Computer Science",
      classLevel: "Computer Science",
      companyName: "Acme Research Lab",
      internshipDomain: "Distributed Systems",
      submissionDate: new Date(),
      visibility: "institution",
    });

    // 4. Index text fingerprint for internal plagiarism comparisons
    const index = await ensureIndexed(entry);

    console.log("\n=======================================================");
    console.log("HISTORICAL REPORT SUCCESSFULLY SEEDED INTO THE LIBRARY!");
    console.log("=======================================================");
    console.log(`Library Entry ID : ${entry.id}`);
    console.log(`Report ID        : ${report.id}`);
    console.log(`Title            : ${entry.title}`);
    console.log(`Academic Year    : ${entry.academicYear}`);
    console.log(`Shingles Indexed : ${index?.corpusShingles?.length || 0}`);
    console.log("=======================================================");
    console.log("\nYou can now submit any new student report containing text from this report,");
    console.log("and run an internal plagiarism check to see a match against this entry!\n");

  } catch (error) {
    console.error("SEEDING ERROR:", error);
  } finally {
    await sequelize.close();
  }
}

seed();
