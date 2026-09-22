/**
 * A report whose content could not be converted must not stay empty forever.
 *
 *   node scripts/verifyWorkspaceContentRecovery.js
 *
 * The bug this pins down: a 5.5 MB Word thesis was converted into an *empty*
 * document (one blank paragraph, 74 bytes). That result is not an error and it is
 * not the placeholder either - it is a valid-looking document - so it was stored
 * as the finished conversion. Every later load saw "content is already there" and
 * never looked at the file again, and the workspace stayed empty no matter how
 * many times the report was opened. The file itself was fine.
 *
 * So the workspace now treats "no text and no figures" as "not converted yet" and
 * reads the file again. These checks hold that behaviour on both sides of the
 * line: a stuck report recovers, an unreadable file says so instead of showing a
 * blank page, and a report that *does* have content is never re-converted over.
 *
 * Runs the real router over HTTP in-process against the real database; creates its
 * own rows and files and removes them again.
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
import { editorContentToDocxBuffer } from "../services/docxService.js";
import { DOCX_MIME } from "../utils/documentTypes.js";
import { isContentlessDocument } from "../utils/documentExtraction.js";

const TAG = `rec${Date.now()}`;
const PASSWORD = "VerifyPass123!";
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const created = { users: [], students: [], reports: [], files: [] };
const uploadsBefore = new Set(fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []);
let failures = 0;

const check = (name, passed, detail = "") => {
  if (!passed) failures++;
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};
const pass = (name, detail = "") => check(name, true, detail);

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use("/api/students", studentRoutes);
app.use("/api/workspace", reportWorkspaceRoutes);
const request = supertest(app);

const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const asUser = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

/** The exact shape an empty conversion produced - see the header. */
const EMPTY_CONVERSION = { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: null } }] };

const writeFixture = async (name, document) => {
  const buffer = await editorContentToDocxBuffer(document, { title: name });
  const fileName = `${TAG}-${name}.docx`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);
  created.files.push(fileName);
  return { fileName, buffer };
};

const makeReport = async (studentId, fileName, documentContent) => {
  const report = await Report.create({
    studentId,
    title: "Recovery Report",
    fileName,
    fileUrl: `/uploads/${fileName}`,
    version: 1,
    status: "submitted",
    submittedAt: new Date(),
    documentContent,
  });
  created.reports.push(report.id);
  return report;
};

const textOf = (documentContent) => (documentContent === null || documentContent === undefined
  ? String(documentContent)
  : JSON.stringify(documentContent));

try {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set - run this from the server directory with its .env present.");
  await sequelize.authenticate();
  sequelize.options.logging = false;

  const studentUser = await User.create({
    name: "Recovery Student",
    email: `${TAG}@example.invalid`,
    password: await bcrypt.hash(PASSWORD, 10),
    role: "student",
    mustChangePassword: false,
    active: true,
  });
  created.users.push(studentUser.id);
  const student = await Student.create({ userId: studentUser.id, matricule: `M-${TAG}`, class: "Recovery" });
  created.students.push(student.id);
  await Internship.create({ studentId: student.id, company: "Acme" });

  const realDocument = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "REPUBLIQUE DU CAMEROUN" }] },
      { type: "paragraph", content: [{ type: "text", text: "Chapter one of the internship report." }] },
    ],
  };
  const real = await writeFixture("real", realDocument);
  const emptyDocx = await writeFixture("empty", { type: "doc", content: [{ type: "paragraph" }] });

  // --- 1. the stuck report recovers ---------------------------------------
  const stuck = await makeReport(student.id, real.fileName, EMPTY_CONVERSION);
  check("the fixture reproduces the stuck state", isContentlessDocument(stuck.documentContent), textOf(stuck.documentContent).slice(0, 70));

  let response = await request.get(`/api/workspace/reports/${stuck.id}/workspace`).set(asUser(studentUser));
  const recovered = response.body.report?.documentContent;
  check(
    "opening a report stuck with an empty conversion recovers its text",
    response.status === 200 && textOf(recovered).includes("REPUBLIQUE DU CAMEROUN"),
    `status ${response.status}, ${textOf(recovered).length} bytes`,
  );
  check("the recovered text is stored, not re-converted on every open", !isContentlessDocument((await Report.findByPk(stuck.id)).documentContent));
  check("no warning is shown once recovery succeeded", !response.body.contentWarning, String(response.body.contentWarning));

  // --- 2. null content (never converted) recovers the same way -------------
  const neverConverted = await makeReport(student.id, real.fileName, null);
  response = await request.get(`/api/workspace/reports/${neverConverted.id}/workspace`).set(asUser(studentUser));
  check(
    "a report with no stored content is converted on open",
    textOf(response.body.report?.documentContent).includes("Chapter one of the internship report"),
    `status ${response.status}`,
  );

  // --- 3. unreadable file: say so, and do not bake in the placeholder ------
  const missing = await makeReport(student.id, `${TAG}-gone.docx`, EMPTY_CONVERSION);
  response = await request.get(`/api/workspace/reports/${missing.id}/workspace`).set(asUser(studentUser));
  check(
    "a report whose file is missing explains itself",
    response.status === 200 && typeof response.body.contentWarning === "string" && response.body.contentWarning.length > 20,
    `warning=${String(response.body.contentWarning).slice(0, 60)}...`,
  );
  const stillStuck = (await Report.findByPk(missing.id)).documentContent;
  check(
    "the unreadable case is not stored as content, so the next open retries",
    isContentlessDocument(stillStuck),
    textOf(stillStuck).slice(0, 60),
  );

  // --- 4. a report that has content is never re-converted over -------------
  const authored = await makeReport(student.id, real.fileName, {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "TEXT THE STUDENT TYPED" }] }],
  });
  response = await request.get(`/api/workspace/reports/${authored.id}/workspace`).set(asUser(studentUser));
  check(
    "stored content is returned as-is, not replaced by the converted file",
    textOf(response.body.report?.documentContent).includes("TEXT THE STUDENT TYPED")
      && !textOf(response.body.report?.documentContent).includes("REPUBLIQUE"),
    `${textOf(response.body.report?.documentContent).slice(0, 60)}`,
  );

  // --- 5. a file that genuinely converts to nothing ------------------------
  const empty = await makeReport(student.id, emptyDocx.fileName, EMPTY_CONVERSION);
  response = await request.get(`/api/workspace/reports/${empty.id}/workspace`).set(asUser(studentUser));
  check(
    "a document that really is empty warns instead of silently showing nothing",
    response.status === 200 && Boolean(response.body.contentWarning),
    `warning=${String(response.body.contentWarning).slice(0, 50)}...`,
  );

  // --- 6. an upload that converts to nothing stores no content -------------
  response = await request
    .post("/api/students/reports")
    .set(asUser(studentUser))
    .field("title", "Empty Upload")
    .attach("report", emptyDocx.buffer, { filename: "empty-upload.docx", contentType: DOCX_MIME });
  const uploaded = response.body.report;
  if (uploaded?.id) created.reports.push(uploaded.id);
  // A student has one report row, so this upload updates the existing one (200)
  // rather than creating a second (201). Either is a successful upload.
  check(
    "an upload that converts to nothing is still accepted",
    response.status === 200 || response.status === 201,
    `status ${response.status}`,
  );
  check(
    "it is stored without content so the workspace can retry, not as an empty document",
    uploaded?.documentContent === null,
    `stored=${textOf(uploaded?.documentContent)}`,
  );
} catch (error) {
  check("suite ran to completion", false, String(error?.message || error));
  console.error("WORKSPACE RECOVERY VERIFICATION ERROR:", error);
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
    await ReportVersion.destroy({ where: { fileName: created.files } }).catch(() => {});
    await Internship.destroy({ where: { studentId: created.students } });
    await Student.destroy({ where: { id: created.students } });
    await User.destroy({ where: { id: created.users } });

    const added = fs.readdirSync(UPLOAD_DIR).filter((f) => !uploadsBefore.has(f));
    added.forEach((f) => fs.unlinkSync(path.join(UPLOAD_DIR, f)));
    console.log(`cleanup: ${created.reports.length} reports, ${created.students.length} students, ${created.users.length} users, ${added.length} files`);
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
}

console.log(`\n${failures === 0 ? "ALL WORKSPACE RECOVERY CHECKS PASSED" : `${failures} WORKSPACE RECOVERY CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
