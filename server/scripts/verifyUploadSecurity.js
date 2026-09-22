// Verification for upload hardening (NFR-SEC-04).
//
// The point of these checks is that every one of them passes *only* because the
// bytes are inspected. Each hostile case below satisfies the old rules - correct
// file name, correct declared MIME type - so a suite that still trusted the
// declaration would report them as accepted. That is what makes this a test of
// the control rather than of the happy path.
//
// Requires the API server to be running.
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import "../models/association.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Notification from "../models/notificationModel.js";

const BASE = "http://localhost:3000/api";
const TAG = `sec${Date.now()}`;
const PASSWORD = "VerifyPass123!";

const ids = { users: [], students: [] };
let failures = 0;

const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mail = (n) => `${TAG}-${n}@example.invalid`;

const login = async (email) => {
  const res = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await res.json()).token;
};

// A real PDF from the project's uploads directory, so the accepted case is
// genuinely accepted for the right reason.
const realPdf = (() => {
  const dir = path.join(process.cwd(), "uploads");
  const name = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith(".pdf"));
  return fs.readFileSync(path.join(dir, name));
})();

const CSV_HEADERS = "student_name,student_email,student_matricule,class,academic_supervisor_name,academic_supervisor_email";

const uploadReport = async (token, { content, filename, type }) => {
  const form = new FormData();
  form.append("title", "Upload Security Probe");
  form.append("report", new Blob([content], { type }), filename);

  const res = await fetch(`${BASE}/students/reports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const uploadCsv = async (token, { content, filename, type }) => {
  const form = new FormData();
  form.append("csv", new Blob([content], { type }), filename);

  const res = await fetch(`${BASE}/admin/import/csv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

try {
  await sequelize.authenticate();

  const admin = await User.create({
    name: "Security Admin",
    email: mail("admin"),
    password: await bcrypt.hash(PASSWORD, 10),
    role: "admin",
    mustChangePassword: false,
    active: true,
  });
  ids.users.push(admin.id);
  const adminToken = await login(admin.email);

  const studentUser = await User.create({
    name: "Security Student",
    email: mail("student"),
    password: await bcrypt.hash(PASSWORD, 10),
    role: "student",
    mustChangePassword: false,
    active: true,
  });
  ids.users.push(studentUser.id);
  const student = await Student.create({ userId: studentUser.id, matricule: `M-${TAG}`, class: "Verification" });
  ids.students.push(student.id);
  await Internship.create({ studentId: student.id, company: "Acme" });
  const studentToken = await login(studentUser.email);

  // --- report upload -------------------------------------------------------
  const honest = await uploadReport(studentToken, { content: realPdf, filename: "honest.pdf", type: "application/pdf" });
  check("a genuine PDF is accepted", honest.status === 201, `status=${honest.status}`);

  // Right name, right MIME, not a PDF. This is the case the old rules allowed.
  const renamed = await uploadReport(studentToken, {
    content: Buffer.from("This is a plain text file that has been renamed.\n", "utf8"),
    filename: "renamed.pdf",
    type: "application/pdf",
  });
  check("a text file renamed .pdf is refused", renamed.status === 415, `status=${renamed.status}`);
  check("the refusal explains it is not a PDF", /signature/i.test(renamed.data?.message || ""), renamed.data?.message);

  // A polyglot: a script preamble ahead of a real PDF body. Signature-scanning
  // would find "%PDF-" anywhere and accept this.
  const polyglot = await uploadReport(studentToken, {
    content: Buffer.concat([Buffer.from("#!/bin/sh\necho pwned\n", "utf8"), realPdf]),
    filename: "polyglot.pdf",
    type: "application/pdf",
  });
  check("a script preamble before a PDF body is refused", polyglot.status === 415, `status=${polyglot.status}`);
  check("the refusal names the executable preamble", /script|executable/i.test(polyglot.data?.message || ""), polyglot.data?.message);

  const windowsExe = await uploadReport(studentToken, {
    content: Buffer.concat([Buffer.from("MZ", "ascii"), Buffer.alloc(64)]),
    filename: "payload.pdf",
    type: "application/pdf",
  });
  check("a Windows executable named .pdf is refused", windowsExe.status === 415, `status=${windowsExe.status}`);

  const empty = await uploadReport(studentToken, { content: Buffer.alloc(0), filename: "empty.pdf", type: "application/pdf" });
  check("an empty file is refused", empty.status === 415, `status=${empty.status}`);

  // Right name and MIME for Word, but not a ZIP container.
  const fakeDocx = await uploadReport(studentToken, {
    content: Buffer.from("not a zip container at all", "utf8"),
    filename: "fake.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  check("a non-ZIP file named .docx is refused", fakeDocx.status === 415, `status=${fakeDocx.status}`);

  // --- CSV import ----------------------------------------------------------
  const goodCsv = `${CSV_HEADERS}\n${TAG} Student,${mail("csv")},M-${TAG}-1,Verification,,,,\n`;
  const accepted = await uploadCsv(adminToken, { content: Buffer.from(goodCsv, "utf8"), filename: "good.csv", type: "text/csv" });
  check("a genuine CSV is accepted", accepted.status === 200, `status=${accepted.status}`);

  // Binary with a .csv name and a CSV MIME. Name and type both say CSV.
  const binaryCsv = await uploadCsv(adminToken, {
    content: Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0x7f]),
    filename: "binary.csv",
    type: "text/csv",
  });
  check("binary content named .csv is refused", binaryCsv.status === 400, `status=${binaryCsv.status}`);
  check("the refusal says it is not text", /text/i.test(binaryCsv.data?.message || ""), binaryCsv.data?.message);

  const scriptCsv = await uploadCsv(adminToken, {
    content: Buffer.from(`${CSV_HEADERS}\n#!/bin/sh\n`, "utf8").subarray(0, 30),
    filename: "script.csv",
    type: "text/csv",
  });
  check("a CSV whose content opens with a script is refused", scriptCsv.status === 400, `status=${scriptCsv.status}`);

  // The old filter accepted *either* a CSV MIME *or* a .csv name. Now both are
  // required, so a PDF with a .csv name is refused at the filter.
  const mislabelled = await uploadCsv(adminToken, { content: realPdf, filename: "report.csv", type: "application/pdf" });
  check("a file whose declared type and extension disagree is refused", [415, 400].includes(mislabelled.status), `status=${mislabelled.status}`);
  check("and the refusal is a readable message, not an opaque 500", mislabelled.status !== 500, `status=${mislabelled.status}`);

  const wrongExtension = await uploadCsv(adminToken, { content: Buffer.from(goodCsv, "utf8"), filename: "students.txt", type: "text/csv" });
  check("a CSV sent with a non-CSV extension is refused", [415, 400].includes(wrongExtension.status), `status=${wrongExtension.status}`);

  // --- nothing invalid is left behind -------------------------------------
  const uploadsDir = path.join(process.cwd(), "uploads");
  const leftovers = fs.readdirSync(uploadsDir).filter((name) => name.includes(TAG));
  check("no rejected report upload is left in the uploads directory", leftovers.length === 0, leftovers.join(", "));

  console.log(`\n${failures === 0 ? "ALL UPLOAD-SECURITY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
} catch (error) {
  failures++;
  console.error("UPLOAD SECURITY VERIFICATION ERROR:", error);
} finally {
  try {
    // The accepted CSV row created a user and student; remove them.
    const created = await User.findAll({ where: { email: { [Op.like]: `${TAG}%` } } });
    for (const user of created) {
      const student = await Student.findOne({ where: { userId: user.id } });
      if (student) {
        await Internship.destroy({ where: { studentId: student.id } });
        await Student.destroy({ where: { id: student.id } });
      }
      await Notification.destroy({ where: { userId: user.id } });
      await User.destroy({ where: { id: user.id } });
    }
    await Internship.destroy({ where: { studentId: ids.students } });
    await Notification.destroy({ where: { userId: ids.users } });
    await Student.destroy({ where: { id: ids.students } });
    await User.destroy({ where: { id: ids.users } });
    console.log("cleanup: probe users and students removed");
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
}
