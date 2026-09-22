// Remove the fake placeholder reports previously auto-seeded into the library.
import { sequelize } from "../config/db.js";
import "../models/association.js";
import LibraryEntry from "../models/libraryEntryModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import Report from "../models/reportModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import User from "../models/userModel.js";

const FAKE_TITLES = [
  "Design and Implementation of a High-Throughput Distributed Telemetry Pipeline",
  "Building Scalable E-Commerce Microservices with React and Node.js",
  "Automated Document Fingerprinting and Plagiarism Detection in Academic Reports",
  "Cloud Infrastructure Automation and CI/CD Pipeline Optimization",
  "Enterprise Vulnerability Assessment and Security Audit Automation",
  "Cross-Platform Mobile Application with Offline-First Data Synchronization",
];

const FAKE_EMAILS = [
  "past_student_hist-2023-001@example.invalid",
  "past_student_hist-2023-002@example.invalid",
  "past_student_hist-2024-003@example.invalid",
  "past_student_hist-2023-004@example.invalid",
  "past_student_hist-2024-005@example.invalid",
  "past_student_hist-2024-006@example.invalid",
];

async function remove() {
  try {
    await sequelize.authenticate();

    for (const title of FAKE_TITLES) {
      const entries = await LibraryEntry.findAll({ where: { title } });
      for (const entry of entries) {
        const reportId = entry.reportId;
        const studentId = entry.studentId;

        await entry.destroy();

        if (reportId) {
          await ReportVersion.destroy({ where: { reportId } });
          const rep = await Report.findByPk(reportId);
          if (rep) await rep.destroy();
        }

        if (studentId) {
          await Internship.destroy({ where: { studentId } });
          const stu = await Student.findByPk(studentId);
          if (stu) {
            const userId = stu.userId;
            await stu.destroy();
            await User.destroy({ where: { id: userId } });
          }
        }

        console.log(`Removed: "${title}"`);
      }
    }

    // Also clean by email in case entries link differently
    for (const email of FAKE_EMAILS) {
      const user = await User.findOne({ where: { email } });
      if (user) {
        await User.destroy({ where: { id: user.id } });
        console.log(`Removed leftover user: ${email}`);
      }
    }

    console.log("\nAll fake placeholder reports removed successfully.");
  } catch (err) {
    console.error("Error removing fake seeds:", err.message);
  } finally {
    await sequelize.close();
  }
}

remove();
