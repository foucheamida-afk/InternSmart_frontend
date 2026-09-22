/**
 * Endpoint check for the Word round trip in the File tab.
 *
 *   node scripts/verifyWordEndpoints.js
 *
 * Runs the real router (auth, role guard, multer MIME filter, controllers and the
 * docx converter) over HTTP in-process. Only the database layer is faked, so this
 * works on a machine with no MySQL running - which is the point: it proves the
 * contract of
 *
 *   POST /api/workspace/import-word   (.docx -> editor content)
 *   POST /api/workspace/export-word   (editor content -> .docx)
 *
 * without needing an account, a report row or a network.
 */
import dotenv from "dotenv";

dotenv.config();

import express from "express";
import supertest from "supertest";
import jwt from "jsonwebtoken";

import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Report from "../models/reportModel.js";
import reportWorkspaceRoutes from "../routes/reportWorkspaceRoutes.js";
import { WORKSPACE_JSON_LIMIT } from "../config/requestLimits.js";
import { docxBufferToPlainText, editorContentToDocxBuffer } from "../services/docxService.js";
import { DOCX_MIME } from "../utils/documentTypes.js";

const STUDENT_USER_ID = 42;
const STUDENT_ID = 7;
const REPORT_ID = 3;
const SUPERVISOR_USER_ID = 99;

const report = {
  id: REPORT_ID,
  studentId: STUDENT_ID,
  title: "Internship report",
  // A .docx report is the editable kind; reportFileFormat() reads these two.
  fileName: "internship-report.docx",
  fileUrl: "/uploads/internship-report.docx",
  currentVersionId: null,
  documentContent: null,
  lockedAt: null,
  status: "draft",
  progress: 0,
  updatedAt: new Date(),
  student: { internship: { academicSupervisorId: SUPERVISOR_USER_ID, professionalSupervisorId: null } },
  async update(values) {
    Object.assign(this, values);
    return this;
  },
};

let currentUser = { id: STUDENT_USER_ID, active: true, role: "student", onboardingCompletedAt: new Date() };

// --- the only fake in this file -------------------------------------------
User.findByPk = async () => currentUser;
Student.findOne = async () => ({ id: STUDENT_ID, userId: STUDENT_USER_ID });
Report.findByPk = async () => (report.__missing ? null : report);
// --------------------------------------------------------------------------

const app = express();
// Same body ceiling the server mounts for /api/workspace (see
// config/requestLimits.js): a report with pictures in it is megabytes, and the
// workspace autosave sends the whole document.
app.use("/api/workspace", express.json({ limit: WORKSPACE_JSON_LIMIT }));
app.use(express.json());
app.use("/api/workspace", reportWorkspaceRoutes);
const request = supertest(app);

const tokenFor = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const asStudent = () => {
  currentUser = { id: STUDENT_USER_ID, active: true, role: "student", onboardingCompletedAt: new Date() };
  return tokenFor(currentUser);
};

const binaryParser = (res, callback) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

const sampleDocument = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Internship Report" }] },
    { type: "paragraph", content: [{ type: "text", text: "Written in the workspace, exported to Word." }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Objective one" }] }] },
      ],
    },
  ],
};

const results = [];
const check = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const run = async () => {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set - run this from the server directory with its .env present.");
    process.exitCode = 1;
    return;
  }

  const docx = await editorContentToDocxBuffer(sampleDocument, { title: "Uploaded from Word" });

  // 1. import without a report: pure conversion, nothing persisted.
  let response = await request
    .post("/api/workspace/import-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .attach("document", docx, { filename: "thesis.docx", contentType: DOCX_MIME });

  const importedTypes = JSON.stringify(response.body.documentContent || {});
  check("import without reportId returns editor content", response.status === 200 && importedTypes.includes("heading"), `status ${response.status}`);
  check("import without reportId does not claim to save", response.body.saved === false, `saved=${response.body.saved}`);

  // 2. import with a reportId: converts and persists.
  report.documentContent = null;
  response = await request
    .post("/api/workspace/import-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .field("reportId", String(REPORT_ID))
    .attach("document", docx, { filename: "thesis.docx", contentType: DOCX_MIME });

  check("import with reportId saves", response.status === 200 && response.body.saved === true, `status ${response.status}`);
  check("import writes documentContent onto the report", report.documentContent?.type === "doc" && report.documentContent.content.length === 3, `blocks=${report.documentContent?.content?.length}`);

  // 3. the MIME filter.
  response = await request
    .post("/api/workspace/import-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .attach("document", Buffer.from("plain text"), { filename: "notes.txt", contentType: "text/plain" });
  check("import rejects a non-Word file", response.status === 400 && /Word \(\.docx\)/.test(response.body.message || ""), `status ${response.status}`);

  response = await request
    .post("/api/workspace/import-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .attach("document", Buffer.from("legacy"), { filename: "old.doc", contentType: "application/msword" });
  check("import explains legacy .doc", response.status === 415 && /save it as \.docx/i.test(response.body.message || ""), `status ${response.status}`);

  // 4. a locked report cannot be overwritten (integrity rule: finalised = immutable).
  report.lockedAt = new Date();
  response = await request
    .post("/api/workspace/import-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .field("reportId", String(REPORT_ID))
    .attach("document", docx, { filename: "thesis.docx", contentType: DOCX_MIME });
  check("import refuses a finalised report", response.status === 409 && response.body.code === "REPORT_LOCKED", `status ${response.status}`);
  report.lockedAt = null;

  // A report uploaded as a PDF is view-only: its archived bytes were hashed for
  // approval, so importing Word content into it would make the editable text and
  // the approved file disagree.
  report.fileName = "internship-report.pdf";
  response = await request
    .post("/api/workspace/import-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .field("reportId", String(REPORT_ID))
    .attach("document", docx, { filename: "thesis.docx", contentType: DOCX_MIME });
  check("import refuses a PDF (view-only) report", response.status === 409 && response.body.code === "REPORT_NOT_EDITABLE", `status ${response.status}`);
  report.fileName = "internship-report.docx";

  // 5. authentication.
  response = await request
    .post("/api/workspace/import-word")
    .attach("document", docx, { filename: "thesis.docx", contentType: DOCX_MIME });
  check("import requires a token", response.status === 401, `status ${response.status}`);

  // 6. export from the live editor document.
  response = await request
    .post("/api/workspace/export-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .send({ documentContent: sampleDocument, title: "Chapter One" })
    .buffer(true)
    .parse(binaryParser);

  const exported = response.body;
  const isZip = Buffer.isBuffer(exported) && exported[0] === 0x50 && exported[1] === 0x4b;
  check("export returns a .docx", response.status === 200 && isZip, `status ${response.status}, ${Buffer.isBuffer(exported) ? exported.length : 0} bytes`);
  check("export sets the Word MIME type", (response.headers["content-type"] || "").includes(DOCX_MIME), response.headers["content-type"]);
  check("export names the download .docx", /filename="chapter-one\.docx"/i.test(response.headers["content-disposition"] || ""), response.headers["content-disposition"]);

  if (isZip) {
    const text = await docxBufferToPlainText(exported);
    check("exported file contains the editor text", text.includes("Written in the workspace"), `${text.length} characters`);
  }

  // 7. export from the stored report (what the File tab does for a saved report).
  report.documentContent = sampleDocument;
  response = await request
    .post("/api/workspace/export-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .send({ reportId: REPORT_ID, title: "Stored" })
    .buffer(true)
    .parse(binaryParser);
  check("export can read the stored report", response.status === 200 && Buffer.isBuffer(response.body) && response.body[0] === 0x50, `status ${response.status}`);

  // 8. nothing to export.
  report.documentContent = null;
  response = await request
    .post("/api/workspace/export-word")
    .set("Authorization", `Bearer ${asStudent()}`)
    .send({ reportId: REPORT_ID })
    .buffer(true)
    .parse(binaryParser);
  check("export refuses an empty report", response.status === 400, `status ${response.status}`);

  // 9. a supervisor assigned to the report may export it, an unrelated one may not.
  currentUser = { id: SUPERVISOR_USER_ID, active: true, role: "academic_supervisor", onboardingCompletedAt: new Date() };
  report.documentContent = sampleDocument;
  response = await request
    .post("/api/workspace/export-word")
    .set("Authorization", `Bearer ${tokenFor(currentUser)}`)
    .send({ reportId: REPORT_ID })
    .buffer(true)
    .parse(binaryParser);
  check("assigned supervisor can export", response.status === 200, `status ${response.status}`);

  currentUser = { id: 1234, active: true, role: "academic_supervisor", onboardingCompletedAt: new Date() };
  response = await request
    .post("/api/workspace/export-word")
    .set("Authorization", `Bearer ${tokenFor(currentUser)}`)
    .send({ reportId: REPORT_ID })
    .buffer(true)
    .parse(binaryParser);
  check("unrelated supervisor cannot export", response.status === 403, `status ${response.status}`);

  // 10. a supervisor may not import into someone's report (students only).
  response = await request
    .post("/api/workspace/import-word")
    .set("Authorization", `Bearer ${tokenFor({ id: SUPERVISOR_USER_ID, role: "academic_supervisor" })}`)
    .field("reportId", String(REPORT_ID))
    .attach("document", docx, { filename: "thesis.docx", contentType: DOCX_MIME });
  check("supervisors cannot import into a report", response.status === 403, `status ${response.status}`);

  // 11. autosaving a picture-heavy report. The workspace PUT carries the whole
  // document, which is what a 100-page thesis with images makes 6.5 MB of - far
  // past express.json()'s 100 kB default, where the save was rejected with a 413
  // that the client could only show as "Offline - saved locally".
  const bigDocument = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "A report with figures in it." }] },
      { type: "paragraph", content: [{ type: "image", attrs: { src: `data:image/png;base64,${"A".repeat(4_800_000)}`, width: 300, height: 200 } }] },
    ],
  };
  const bigBytes = Buffer.byteLength(JSON.stringify(bigDocument));
  report.fileName = "internship-report.docx";
  response = await request
    .put(`/api/workspace/reports/${REPORT_ID}/workspace`)
    .set("Authorization", `Bearer ${asStudent()}`)
    .send({ documentContent: bigDocument });
  const storedBytes = Buffer.byteLength(JSON.stringify(report.documentContent || null));
  check(
    `autosave accepts a ${(bigBytes / 1048576).toFixed(1)} MB document`,
    response.status === 200 && storedBytes === bigBytes,
    `status ${response.status}, stored ${(storedBytes / 1048576).toFixed(1)} MB`,
  );

  // 12. A document above the *storable* ceiling is refused with a reason rather
  // than handed to the database to fail on. The ceiling is normally
  // min(REPORT_CONTENT_MAX_MB, mysql max_allowed_packet - headroom); it is lowered
  // here so the case can be exercised on a database whose packet limit is large.
  const previousMax = process.env.REPORT_CONTENT_MAX_MB;
  process.env.REPORT_CONTENT_MAX_MB = "1";
  response = await request
    .put(`/api/workspace/reports/${REPORT_ID}/workspace`)
    .set("Authorization", `Bearer ${asStudent()}`)
    .send({ documentContent: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(2_500_000) }] }] } });
  if (previousMax === undefined) delete process.env.REPORT_CONTENT_MAX_MB;
  else process.env.REPORT_CONTENT_MAX_MB = previousMax;
  check("an over-sized document is refused, not truncated", response.status === 413 && response.body.code === "REPORT_CONTENT_TOO_LARGE", `status ${response.status} ${response.body.code || ""}`);

  const failed = results.filter((entry) => !entry.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
};

run().catch((error) => {
  console.error("VERIFY FAILED:", error);
  process.exitCode = 1;
});
