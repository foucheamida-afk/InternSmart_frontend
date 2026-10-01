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

const items = [
  {
    filePath: "D:\\myDocuments\\Digital Archive system.pdf",
    academicYear: "2024/2025",
    title: "Digital Archive system",
  },
  {
    filePath: "D:\\myDocuments\\EMIE GRACE's REPORT-updated_081330.pdf",
    academicYear: "2024/2025",
    title: "EMIE GRACE's REPORT",
  },
  {
    filePath: "D:\\myDocuments\\manou geraldine.pdf",
    academicYear: "2024/2025",
    title: "manou geraldine",
  },
  {
    filePath: "D:\\myDocuments\\Pamela.pdf",
    academicYear: "2024/2025",
    title: "Pamela",
  },
  {
    filePath: "D:\\myDocuments\\PRISCILLE2.pdf",
    academicYear: "2024/2025",
    title: "PRISCILLE2",
  },
  {
    filePath: "D:\\myDocuments\\Rapport aminou1.pdf",
    academicYear: "2024/2025",
    title: "Rapport aminou1",
  },
  {
    filePath: "D:\\myDocuments\\RAPPORT DE STAGE MBAWAT ETIENNE DUMARD - Get_Ready .pdf",
    academicYear: "2024/2025",
    title: "MBAWAT ETIENNE DUMARD - Get_Ready",
  },
  {
    filePath: "D:\\myDocuments\\Rapport_de_stage TCHANTEO Magloire.pdf",
    academicYear: "2024/2025",
    title: "TCHANTEO Magloire",
  },
  {
    filePath: "D:\\myDocuments\\TEMFACK_INTERNSHIP-REPORT_V1.5.pdf",
    academicYear: "2024/2025",
    title: "TEMFACK_ INTERNSHIP-REPORT_V1.5",
  },
];

async function runBatchImport() {
  try {
    await sequelize.authenticate();
    console.log("Database connection authenticated successfully.\n");

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      const resolvedPath = path.resolve(item.filePath);
      console.log(`Processing: "${item.title}" (${item.academicYear})`);
      console.log(`File Path : ${resolvedPath}`);

      if (!fs.existsSync(resolvedPath)) {
        console.error(`ERROR: File not found at path: ${resolvedPath}\n`);
        failCount++;
        continue;
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const originalFilename = path.basename(resolvedPath);

      let plainText = "";
      let docTree = null;

      try {
        if (ext === ".docx" || ext === ".doc") {
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
          docTree = await extractPdfText(resolvedPath);
          plainText = (plainTextFromDocumentTree(docTree) || "").trim();
        }
      } catch (extractErr) {
        console.warn(`Text extraction warning for ${originalFilename}:`, extractErr.message);
      }

      const storedFileName = `import_${Date.now()}_${Math.floor(Math.random() * 1000)}_${originalFilename}`;
      const destinationPath = path.join(uploadsDir, storedFileName);
      fs.copyFileSync(resolvedPath, destinationPath);

      const tag = Date.now() + Math.floor(Math.random() * 10000);
      const email = `student_lib_${tag}@internsmart.invalid`;
      const passwordHash = await bcrypt.hash("Password123!", 10);

      const user = await User.create({
        name: `${item.title} (Student)`,
        email,
        password: passwordHash,
        role: "student",
        mustChangePassword: false,
        active: true,
      });

      const student = await Student.create({
        userId: user.id,
        matricule: `LIB-${tag}`,
        class: "Library Archive",
      });

      await Internship.create({
        studentId: student.id,
        company: "Academic Partner",
        academicYear: item.academicYear,
        program: "Computer Science",
        internshipDomain: "Software Engineering",
      });

      const report = await Report.create({
        studentId: student.id,
        title: item.title,
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

      const abstract = plainText ? plainText.slice(0, 400).trim() + (plainText.length > 400 ? "..." : "") : "Imported library report.";

      const entry = await LibraryEntry.create({
        reportId: report.id,
        reportVersionId: version.id,
        studentId: student.id,
        title: item.title,
        abstract,
        keywords: ["imported", "academic_year_" + item.academicYear.replace("/", "_")],
        academicYear: item.academicYear,
        program: "Computer Science",
        classLevel: "Library Archive",
        companyName: "Academic Partner",
        internshipDomain: "Software Engineering",
        submissionDate: new Date(),
        visibility: "institution",
      });

      const index = await ensureIndexed(entry);

      console.log(`SUCCESS: Imported Library Entry ID: ${entry.id} | Words: ${index?.corpusWordCount || 0} | Shingles: ${index?.corpusShingles?.length || 0}\n`);
      successCount++;
    }

    console.log("=======================================================");
    console.log(`BATCH IMPORT SUMMARY: ${successCount} Succeeded, ${failCount} Failed`);
    console.log("=======================================================");

  } catch (error) {
    console.error("BATCH IMPORT CRITICAL ERROR:", error);
  } finally {
    await sequelize.close();
  }
}

runBatchImport();
