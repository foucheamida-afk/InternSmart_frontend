// Script to import PDF or Word (.docx / .doc) documents from your local PC into the InternSmart virtual library.
//
// Usage:
//   node scripts/importPdfToLibrary.js <path-to-document> [academic-year] [report-title]
//
// Examples:
//   node scripts/importPdfToLibrary.js "C:\Users\simeb\Desktop\sample.pdf" "2023/2024" "Distributed Systems Project"
//   node scripts/importPdfToLibrary.js "C:\Users\simeb\Desktop\report.docx" "2023/2024" "Word Document Project"
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import mammoth from "mammoth";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import LibraryEntry from "../models/libraryEntryModel.js";
import extractPdfText from "../utils/extractPdfText.js";
import { plainTextFromDocumentTree } from "../utils/textFingerprint.js";
import { ensureIndexed } from "../services/plagiarism/internalProvider.js";

const docPathArg = process.argv[2];
const academicYearArg = process.argv[3] || "2023/2024";
const customTitle = process.argv[4];

if (!docPathArg) {
  console.error("Error: Please provide the path to a PDF or Word (.docx) file on your computer.");
  console.error('Usage: node scripts/importPdfToLibrary.js "C:\\path\\to\\report.docx" "2023/2024" "Report Title"');
  process.exit(1);
}

const resolvedPath = path.resolve(docPathArg);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Error: File not found at path: ${resolvedPath}`);
  process.exit(1);
}

async function importDocument() {
  try {
    await sequelize.authenticate();
    const ext = path.extname(resolvedPath).toLowerCase();
    console.log(`Reading ${ext.toUpperCase()} document: ${resolvedPath}...`);

    const originalFilename = path.basename(resolvedPath);
    const title = customTitle || path.basename(resolvedPath, path.extname(resolvedPath)).replace(/[-_]/g, " ");

    let plainText = "";
    let docTree = null;

    if (ext === ".docx" || ext === ".doc") {
      // Extract text from Word Document using mammoth
      const result = await mammoth.extractRawText({ path: resolvedPath });
      plainText = (result.value || "").trim();

      const paragraphs = plainText.split(/\n\s*\n/).filter(Boolean);
      docTree = {
        type: "doc",
        content: paragraphs.map((text) => ({
          type: "paragraph",
          content: [{ type: "text", text: text.trim() }],
        })),
      };
    } else {
      // Extract text from PDF Document
      docTree = await extractPdfText(resolvedPath);
      plainText = (plainTextFromDocumentTree(docTree) || "").trim();
    }

    if (!plainText) {
      console.error("Warning: Could not extract plain text from this document (file may be empty or unreadable).");
    }

    // Copy file into server/uploads/ directory
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const storedFileName = `import_${Date.now()}_${originalFilename}`;
    const destinationPath = path.join(uploadsDir, storedFileName);
    fs.copyFileSync(resolvedPath, destinationPath);

    // Create historical student profile
    const tag = Date.now();
    const email = `imported_student_${tag}@example.invalid`;
    const passwordHash = await bcrypt.hash("Password123!", 10);

    const user = await User.create({
      name: `Imported Student (${academicYearArg})`,
      email,
      password: passwordHash,
      role: "student",
      mustChangePassword: false,
      active: true,
    });

    const student = await Student.create({
      userId: user.id,
      matricule: `IMP-${tag}`,
      class: "Imported Cohort",
    });

    await Internship.create({
      studentId: student.id,
      company: "Imported Enterprise",
      academicYear: academicYearArg,
      program: "Computer Science",
      internshipDomain: "Software Engineering",
    });

    // Create Report & Version
    const report = await Report.create({
      studentId: student.id,
      title,
      fileName: originalFilename,
      fileUrl: `/uploads/${storedFileName}`,
      status: "final_submitted",
      submittedAt: new Date(),
      documentContent: docTree,
    });

    const version = await ReportVersion.create({
      reportId: report.id,
      versionNumber: 1,
      fileName: originalFilename,
      fileUrl: `/uploads/${storedFileName}`,
      fileHash: `hash-${report.id}`,
    });

    await report.update({
      currentVersionId: version.id,
      lockedAt: new Date(),
      finalSubmittedAt: new Date(),
    });

    // Create Library Entry
    const abstract = plainText.slice(0, 400).trim() + (plainText.length > 400 ? "..." : "");
    const entry = await LibraryEntry.create({
      reportId: report.id,
      reportVersionId: version.id,
      studentId: student.id,
      title: report.title,
      abstract: abstract || "Imported document report.",
      keywords: ["imported", ext.replace(".", ""), "historical"],
      academicYear: academicYearArg,
      program: "Computer Science",
      classLevel: "Imported Cohort",
      companyName: "Imported Enterprise",
      internshipDomain: "Software Engineering",
      submissionDate: new Date(),
      visibility: "institution",
    });

    // Index text shingles for internal plagiarism comparisons
    const index = await ensureIndexed(entry);

    console.log("\n=======================================================");
    console.log("DOCUMENT SUCCESSFULLY IMPORTED INTO VIRTUAL LIBRARY!");
    console.log("=======================================================");
    console.log(`File Type        : ${ext.toUpperCase()}`);
    console.log(`Original Path    : ${resolvedPath}`);
    console.log(`Stored Path      : ${destinationPath}`);
    console.log(`Library Entry ID : ${entry.id}`);
    console.log(`Title            : ${entry.title}`);
    console.log(`Academic Year    : ${entry.academicYear}`);
    console.log(`Extracted Words  : ${index?.corpusWordCount || 0}`);
    console.log(`Indexed Shingles : ${index?.corpusShingles?.length || 0}`);
    console.log("=======================================================");
    console.log("\nThis document is now in the library database and ready for plagiarism comparisons!\n");

  } catch (error) {
    console.error("DOCUMENT IMPORT ERROR:", error);
  } finally {
    await sequelize.close();
  }
}

importDocument();
