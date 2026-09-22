/**
 * PDF vs Word report handling, end to end (§ My Reports).
 *
 *   node scripts/verifyReportFormats.js
 *
 * Both formats may be uploaded, but they are not equivalent: a Word (.docx)
 * report is converted into editable content and opens in the writing workspace,
 * while a PDF is view-only. That rule is decided on the server and enforced in
 * four places, which is exactly why it needs a test - the upload response, the
 * My Reports listing, the workspace load/save and the Word import can each drift
 * apart, and a client that "just hides the button" would hide the drift rather
 * than catch it.
 *
 * The real routers run over HTTP in-process against the real database, so this
 * needs no running API server. It creates its own users and reports and removes
 * them again, along with the files the upload middleware writes.
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
import ReportSubmission from "../models/reportSubmissionModel.js";
import studentRoutes from "../routes/studentRoutes.js";
import reportWorkspaceRoutes from "../routes/reportWorkspaceRoutes.js";
import { editorContentToDocxBuffer } from "../services/docxService.js";
import { DOCX_MIME, PDF_MIME } from "../utils/documentTypes.js";

const TAG = `fmt${Date.now()}`;
const PASSWORD = "VerifyPass123!";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const created = { users: [], students: [], reports: [] };
const uploadsBefore = new Set(fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []);
let failures = 0;

const check = (name, passed, detail = "") => {
  if (!passed) failures++;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mail = (n) => `${TAG}-${n}@example.invalid`;

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use("/api/students", studentRoutes);
app.use("/api/workspace", reportWorkspaceRoutes);
const request = supertest(app);

const tokenFor = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const asUser = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

const makeUser = async (name, email, role) => {
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(PASSWORD, 10),
    role,
    mustChangePassword: false,
    active: true,
    onboardingCompletedAt: role.includes("supervisor") ? new Date() : null,
  });
  created.users.push(user.id);
  return user;
};

const sampleDocument = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Internship Report" }] },
    { type: "paragraph", content: [{ type: "text", text: "Uploaded as a Word document." }] },
  ],
};

const uploadReport = (user, options) =>
  request
    .post("/api/students/reports")
    .set(asUser(user))
    .field("title", options.title)
    .attach("report", options.buffer, { filename: options.filename, contentType: options.contentType });

try {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set - run this from the server directory with its .env present.");
  await sequelize.authenticate();
  // Every statement is echoed to the console by default, which buries the checks.
  sequelize.options.logging = false;

  const academic = await makeUser("Format Academic", mail("academic"), "academic_supervisor");
  const studentAUser = await makeUser("Format Student A", mail("student-a"), "student");
  const studentBUser = await makeUser("Format Student B", mail("student-b"), "student");

  const studentA = await Student.create({ userId: studentAUser.id, matricule: `M-${TAG}-A`, class: "Format" });
  const studentB = await Student.create({ userId: studentBUser.id, matricule: `M-${TAG}-B`, class: "Format" });
  created.students.push(studentA.id, studentB.id);
  await Internship.create({ studentId: studentA.id, academicSupervisorId: academic.id, company: "Acme" });
  await Internship.create({ studentId: studentB.id, academicSupervisorId: academic.id, company: "Acme" });

  const docxBuffer = await editorContentToDocxBuffer(sampleDocument, { title: "Word report" });
  const pdfName = fs.readdirSync(UPLOAD_DIR).find((f) => f.toLowerCase().endsWith(".pdf"));
  if (!pdfName) throw new Error("no sample PDF in uploads/ to upload");
  const pdfBuffer = fs.readFileSync(path.join(UPLOAD_DIR, pdfName));

  // --- A. a Word upload is accepted, editable, and converted ---------------
  let response = await uploadReport(studentAUser, {
    title: "Word Report",
    filename: "internship-report.docx",
    contentType: DOCX_MIME,
    buffer: docxBuffer,
  });
  const docxReport = response.body.report;
  check("a Word (.docx) report uploads", response.status === 201, `status ${response.status} ${response.body.message || ""}`);
  check(
    "the upload response marks a Word report editable",
    docxReport?.fileType === "docx" && docxReport?.editable === true,
    `fileType=${docxReport?.fileType} editable=${docxReport?.editable}`,
  );
  check(
    "the Word upload was converted into editor content",
    docxReport?.documentContent && typeof docxReport.documentContent === "object",
    `documentContent=${typeof docxReport?.documentContent}`,
  );
  if (docxReport?.id) created.reports.push(docxReport.id);

  // --- B. My Reports labels the format the cards read ----------------------
  response = await request.get("/api/students/my-reports").set(asUser(studentAUser));
  let listed = response.body.reports?.find((r) => r.id === docxReport.id);
  check("my-reports carries fileType/editable for the Word report", listed?.fileType === "docx" && listed?.editable === true, `fileType=${listed?.fileType}`);
  check("my-reports still carries the fields the page already used", Boolean(listed?.fileName && typeof listed.version === "number" && listed?.status), `fileName=${listed?.fileName}`);

  // --- C. the workspace opens a Word report for editing --------------------
  response = await request.get(`/api/workspace/reports/${docxReport.id}/workspace`).set(asUser(studentAUser));
  check("workspace opens a Word report for editing", response.status === 200 && response.body.editable === true && response.body.readOnly === false, `status ${response.status} editable=${response.body.editable} readOnly=${response.body.readOnly}`);
  check("workspace reports the file type it decided from", response.body.report?.fileType === "docx", `fileType=${response.body.report?.fileType}`);

  response = await request
    .put(`/api/workspace/reports/${docxReport.id}/workspace`)
    .set(asUser(studentAUser))
    .send({ documentContent: sampleDocument });
  check("saving a Word report is allowed", response.status === 200, `status ${response.status} ${response.body.message || ""}`);

  // --- D. the Word import still works on a Word report ---------------------
  response = await request
    .post("/api/workspace/import-word")
    .set(asUser(studentAUser))
    .field("reportId", String(docxReport.id))
    .attach("document", docxBuffer, { filename: "revision.docx", contentType: DOCX_MIME });
  check("importing Word into a Word report still saves", response.status === 200 && response.body.saved === true, `status ${response.status} ${response.body.message || ""}`);

  // --- E. a PDF upload is accepted, and is view-only -----------------------
  response = await uploadReport(studentBUser, {
    title: "PDF Report",
    filename: "internship-report.pdf",
    contentType: PDF_MIME,
    buffer: pdfBuffer,
  });
  const pdfReport = response.body.report;
  check("a PDF report uploads", response.status === 201, `status ${response.status} ${response.body.message || ""}`);
  check(
    "the upload response marks the PDF view-only",
    pdfReport?.fileType === "pdf" && pdfReport?.editable === false,
    `fileType=${pdfReport?.fileType} editable=${pdfReport?.editable}`,
  );
  if (pdfReport?.id) created.reports.push(pdfReport.id);

  // A PDF's content is the file. Nothing derived from it may be stored: the PDF
  // workspace reads the structure out of the file and writes edits back to it, so
  // a copy in `documentContent` would be a second version of the same document.
  const storedPdf = pdfReport?.id ? await Report.findByPk(pdfReport.id) : null;
  check(
    "a PDF upload stores no converted content",
    storedPdf?.documentContent === null,
    `documentContent=${storedPdf?.documentContent === null ? "null" : typeof storedPdf?.documentContent}`,
  );

  response = await request.get("/api/students/my-reports").set(asUser(studentBUser));
  listed = response.body.reports?.find((r) => r.id === pdfReport.id);
  check("my-reports marks the PDF view-only", listed?.fileType === "pdf" && listed?.editable === false, `fileType=${listed?.fileType}`);

  response = await request.get(`/api/workspace/reports/${pdfReport.id}/workspace`).set(asUser(studentBUser));
  check(
    "the workspace is read-only for the PDF's own author",
    response.status === 200 && response.body.editable === false && response.body.readOnly === true,
    `status ${response.status} editable=${response.body.editable} readOnly=${response.body.readOnly}`,
  );

  response = await request
    .put(`/api/workspace/reports/${pdfReport.id}/workspace`)
    .set(asUser(studentBUser))
    .send({ documentContent: sampleDocument });
  check(
    "saving edits into a PDF report is refused",
    response.status === 409 && response.body.code === "REPORT_NOT_EDITABLE",
    `status ${response.status} code=${response.body.code}`,
  );

  response = await request
    .post("/api/workspace/import-word")
    .set(asUser(studentBUser))
    .field("reportId", String(pdfReport.id))
    .attach("document", docxBuffer, { filename: "revision.docx", contentType: DOCX_MIME });
  check(
    "importing Word into a PDF report is refused",
    response.status === 409 && response.body.code === "REPORT_NOT_EDITABLE",
    `status ${response.status} code=${response.body.code}`,
  );

  // --- F. a report replaced by a PDF flips to view-only --------------------
  // Student A re-uploads, which advances the same report to version 2 as a PDF.
  response = await uploadReport(studentAUser, {
    title: "Word Report",
    filename: "internship-report.pdf",
    contentType: PDF_MIME,
    buffer: pdfBuffer,
  });
  const flipped = response.body.report;
  check("re-uploading a report as a PDF succeeds as an update", response.status === 200, `status ${response.status}`);
  check(
    "the report is now view-only and the version advanced",
    flipped?.fileType === "pdf" && flipped?.editable === false && flipped?.version === 2,
    `fileType=${flipped?.fileType} version=${flipped?.version}`,
  );

  response = await request
    .put(`/api/workspace/reports/${docxReport.id}/workspace`)
    .set(asUser(studentAUser))
    .send({ documentContent: sampleDocument });
  check("the flipped report no longer accepts edits", response.status === 409 && response.body.code === "REPORT_NOT_EDITABLE", `status ${response.status}`);

  const versionRows = await ReportVersion.findAll({ where: { reportId: docxReport.id }, order: [["versionNumber", "ASC"]] });
  check(
    "both versions are kept, with the type recorded per version",
    versionRows.length === 2 && versionRows[0].fileName.endsWith(".docx") && versionRows[1].fileName.endsWith(".pdf"),
    versionRows.map((v) => v.fileName).join(" -> "),
  );

  // --- G. formats that are still refused ----------------------------------
  response = await uploadReport(studentBUser, {
    title: "Legacy",
    filename: "old.doc",
    contentType: "application/msword",
    buffer: Buffer.from("legacy"),
  });
  check("legacy .doc is refused with an actionable message", response.status === 415 && /save it as \.docx/i.test(response.body.message || ""), `status ${response.status}`);

  response = await uploadReport(studentBUser, {
    title: "Notes",
    filename: "notes.txt",
    contentType: "text/plain",
    buffer: Buffer.from("notes"),
  });
  check("an unrelated format is refused", response.status === 415 && /PDF or Word \(\.docx\)/i.test(response.body.message || ""), `status ${response.status}`);
} catch (error) {
  failures++;
  console.error("REPORT FORMAT VERIFICATION ERROR:", error);
} finally {
  try {
    const reportIds = created.reports.filter(Number.isInteger);
    if (reportIds.length) {
      const where = { reportId: reportIds };
      await ReportComment.destroy({ where });
      await ReportAudit.destroy({ where });
      await ReportSubmission.destroy({ where });
      await ReportReview.destroy({ where });
      await ReportVersion.destroy({ where });
      await Report.destroy({ where: { id: reportIds } });
    }
    await Internship.destroy({ where: { studentId: created.students } });
    await Student.destroy({ where: { id: created.students } });
    await User.destroy({ where: { id: created.users } });

    // The upload middleware writes every accepted file to uploads/; leave the
    // directory as it was found rather than accumulating test documents.
    const added = fs.readdirSync(UPLOAD_DIR).filter((f) => !uploadsBefore.has(f));
    added.forEach((f) => fs.unlinkSync(path.join(UPLOAD_DIR, f)));
    console.log(`cleanup: ${created.reports.length} reports, ${created.students.length} students, ${created.users.length} users, ${added.length} uploaded files`);
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
}

console.log(`\n${failures === 0 ? "ALL REPORT FORMAT CHECKS PASSED" : `${failures} REPORT FORMAT CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
