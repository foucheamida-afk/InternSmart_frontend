/**
 * Size ceiling for stored report content - the "5 MB Word upload returns 500" bug.
 *
 *   node scripts/verifyReportSizeGuard.js
 *
 * A Word report is stored as its *converted* editor content, not as the .docx,
 * and every embedded image becomes a base64 data URI. Measured on real files, a
 * 4.5 MB screenshot becomes 6.0 MB of JSON. That value travels to the database in
 * one statement, so it is bounded by `max_allowed_packet` - 1 MB on a default
 * XAMPP-style MariaDB. Exceeding it makes the server drop the connection
 * (`ECONNRESET`) rather than return an error, which is why the upload surfaced as
 * an unexplained 500 and why it could also kill a pooled connection mid-request.
 *
 * What is checked here:
 *   - a document over the ceiling is refused with 413 REPORT_CONTENT_TOO_LARGE and
 *     real numbers, on all three write paths (upload, workspace save, Word import),
 *     and never with a 500;
 *   - the refused upload leaves no orphaned file behind;
 *   - when the database *is* configured to accept it, the same multi-MB Word
 *     report stores and reads back intact.
 *
 * Precondition for the last part: `max_allowed_packet` must be at least the size
 * of the converted document (the suite prints the value it detected). Raise it in
 * my.ini `[mysqld]` (e.g. `max_allowed_packet=64M`), restart MariaDB, then restart
 * the API server so pooled connections pick it up.
 *
 * Runs the real routers over HTTP in-process against the real database and cleans
 * up after itself, including the files the upload middleware writes.
 */
import dotenv from "dotenv";

dotenv.config();

import fs from "fs";
import path from "path";
import express from "express";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import ReportReview from "../models/reportReviewModel.js";
import ReportAudit from "../models/reportAuditModel.js";
import ReportComment from "../models/reportCommentModel.js";
import studentRoutes from "../routes/studentRoutes.js";
import reportWorkspaceRoutes from "../routes/reportWorkspaceRoutes.js";
import { editorContentToDocxBuffer, docxBufferToEditorContent } from "../services/docxService.js";
import { DOCX_MIME } from "../utils/documentTypes.js";
import { measureDocumentContent, detectPacketLimit } from "../utils/storedContentLimit.js";

const TAG = `size${Date.now()}`;
const PASSWORD = "VerifyPass123!";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const IMAGE_PATH = path.join(process.cwd(), "..", "client", "src", "assets", "images", "logo.png");

const created = { users: [], students: [], reports: [] };
const uploadsBefore = new Set(fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []);
let failures = 0;

const check = (name, passed, detail = "") => {
  if (!passed) failures++;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use("/api/students", studentRoutes);
app.use("/api/workspace", reportWorkspaceRoutes);
const request = supertest(app);

const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const asUser = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

const makeUser = async (name, email, role) => {
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(PASSWORD, 10),
    role,
    mustChangePassword: false,
    active: true,
  });
  created.users.push(user.id);
  return user;
};

// A report with real figures in it: the same 710 KB screenshot repeated, which is
// what a written internship report looks like. The .docx ends up a few MB and the
// converted content several MB - the shape of the file that failed.
const buildIllustratedReport = async (imageCount) => {
  const image = fs.readFileSync(IMAGE_PATH).toString("base64");
  const content = [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Internship Report" }] },
    { type: "paragraph", content: [{ type: "text", text: "Report with figures." }] },
  ];
  for (let i = 0; i < imageCount; i++) {
    content.push({ type: "image", attrs: { src: `data:image/png;base64,${image}`, alt: `Figure ${i + 1}` } });
  }
  return { type: "doc", content };
};

const uploadReport = (user, buffer, filename) =>
  request
    .post("/api/students/reports")
    .set(asUser(user))
    .field("title", "Illustrated Report")
    .attach("report", buffer, { filename, contentType: DOCX_MIME });

try {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set - run this from the server directory with its .env present.");
  if (!fs.existsSync(IMAGE_PATH)) throw new Error(`no image to build the illustrated report from: ${IMAGE_PATH}`);
  await sequelize.authenticate();
  sequelize.options.logging = false;

  const packetLimit = await detectPacketLimit();
  console.log(`detected max_allowed_packet: ${packetLimit ? mb(packetLimit) : "unknown"}`);
  console.log(`client-side ceiling (REPORT_CONTENT_MAX_MB): ${process.env.REPORT_CONTENT_MAX_MB || "default 16"}\n`);

  const studentUser = await makeUser("Size Student", `${TAG}@example.invalid`, "student");
  const student = await Student.create({ userId: studentUser.id, matricule: `M-${TAG}`, class: "Size" });
  created.students.push(student.id);
  await Internship.create({ studentId: student.id, company: "Acme" });

  const editorDocument = await buildIllustratedReport(6);
  const docx = await editorContentToDocxBuffer(editorDocument, { title: "Illustrated Report" });
  const { document: converted } = await docxBufferToEditorContent(docx);
  const convertedBytes = measureDocumentContent(converted);
  console.log(`test document: ${mb(docx.length)} .docx -> ${mb(convertedBytes)} of editor content\n`);

  // The point of the bug: what gets stored is the converted content, and it is
  // several times the file. (This test document is deliberately an extreme case -
  // the .docx stores one copy of the repeated screenshot while the conversion
  // inlines every occurrence as base64.)
  check(
    "the converted content exceeds the old 1 MB packet limit",
    convertedBytes > 1024 * 1024,
    `${mb(docx.length)} file -> ${mb(convertedBytes)} content (${(convertedBytes / docx.length).toFixed(1)}x)`,
  );

  // --- 1. the ceiling is enforced on upload, with a reason -----------------
  process.env.REPORT_CONTENT_MAX_MB = "1";
  let response = await uploadReport(studentUser, docx, "illustrated-report.docx");
  check(
    "an over-sized Word upload is refused with 413, not a 500",
    response.status === 413 && response.body.code === "REPORT_CONTENT_TOO_LARGE",
    `status ${response.status} code=${response.body.code}`,
  );
  check(
    "the refusal names the real sizes so the student can act",
    response.body.contentBytes > 1024 * 1024 && response.body.contentLimitBytes > 0 && /max_allowed_packet|PDF/.test(response.body.message || ""),
    `bytes=${response.body.contentBytes} limit=${response.body.contentLimitBytes}`,
  );

  const afterRefusal = fs.readdirSync(UPLOAD_DIR).filter((f) => !uploadsBefore.has(f));
  check("a refused upload leaves no orphaned file in uploads/", afterRefusal.length === 0, `${afterRefusal.length} new file(s)`);

  // --- 2. the ceiling is enforced on the workspace save -------------------
  process.env.REPORT_CONTENT_MAX_MB = "16";
  response = await uploadReport(studentUser, docx, "illustrated-report.docx");
  const storedReportId = response.body.report?.id;
  check("the same report uploads once the ceiling is raised", response.status === 201, `status ${response.status} ${response.body.message || ""}`);
  if (storedReportId) created.reports.push(storedReportId);

  if (storedReportId) {
    check(
      "the multi-MB converted content was stored in one statement",
      response.body.report?.documentContent && measureDocumentContent(response.body.report.documentContent) === convertedBytes,
      `${mb(measureDocumentContent(response.body.report?.documentContent))} stored`,
    );

    response = await request.get(`/api/workspace/reports/${storedReportId}/workspace`).set(asUser(studentUser));
    check(
      "the workspace reads the large document back intact",
      response.status === 200 && measureDocumentContent(response.body.report?.documentContent) === convertedBytes,
      `status ${response.status}, ${mb(measureDocumentContent(response.body.report?.documentContent))}`,
    );

    process.env.REPORT_CONTENT_MAX_MB = "1";
    response = await request
      .put(`/api/workspace/reports/${storedReportId}/workspace`)
      .set(asUser(studentUser))
      .send({ documentContent: converted });
    check(
      "an over-sized autosave is refused with 413 so edits are not silently lost",
      response.status === 413 && response.body.code === "REPORT_CONTENT_TOO_LARGE",
      `status ${response.status} code=${response.body.code}`,
    );

    response = await request
      .post("/api/workspace/import-word")
      .set(asUser(studentUser))
      .field("reportId", String(storedReportId))
      .attach("document", docx, { filename: "illustrated-report.docx", contentType: DOCX_MIME });
    check(
      "an over-sized Word import is refused with 413",
      response.status === 413 && response.body.code === "REPORT_CONTENT_TOO_LARGE",
      `status ${response.status} code=${response.body.code}`,
    );

    // Nothing above may have written a partial document.
    const after = await Report.findByPk(storedReportId);
    check(
      "the refused writes left the stored document untouched",
      measureDocumentContent(after?.documentContent) === convertedBytes,
      `${mb(measureDocumentContent(after?.documentContent))} still stored`,
    );
  }

  process.env.REPORT_CONTENT_MAX_MB = "16";
} catch (error) {
  failures++;
  console.error("REPORT SIZE GUARD VERIFICATION ERROR:", error);
} finally {
  try {
    const reportIds = created.reports.filter(Number.isInteger);
    if (reportIds.length) {
      const where = { reportId: reportIds };
      await ReportComment.destroy({ where });
      await ReportAudit.destroy({ where });
      await ReportReview.destroy({ where });
      await ReportVersion.destroy({ where });
      await Report.destroy({ where: { id: reportIds } });
    }
    await Internship.destroy({ where: { studentId: created.students } });
    await Student.destroy({ where: { id: created.students } });
    await User.destroy({ where: { id: created.users } });

    const added = fs.readdirSync(UPLOAD_DIR).filter((f) => !uploadsBefore.has(f));
    added.forEach((f) => fs.unlinkSync(path.join(UPLOAD_DIR, f)));
    console.log(`cleanup: ${created.reports.length} reports, ${created.students.length} students, ${created.users.length} users, ${added.length} uploaded files`);
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
}

console.log(`\n${failures === 0 ? "ALL REPORT SIZE GUARD CHECKS PASSED" : `${failures} REPORT SIZE GUARD CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
