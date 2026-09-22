// Contract check between the new client components and the API (§4.12).
//
// The components cannot be clicked through here, so instead this asserts that
// every field they read actually exists with the expected shape. A missing field
// is the failure mode a browser would show as a blank panel, and it would not be
// caught by the workflow suite - that suite checks behaviour, this checks shape.
//
// Requires the API server to be running.
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import ReportReview from "../models/reportReviewModel.js";
import ReportAudit from "../models/reportAuditModel.js";
import ReportSubmission from "../models/reportSubmissionModel.js";
import Notification from "../models/notificationModel.js";

const BASE = "http://localhost:3000/api";
const TAG = `uic${Date.now()}`;
const PASSWORD = "VerifyPass123!";

const ids = { users: [], students: [], reports: [] };
let failures = 0;

const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mail = (n) => `${TAG}-${n}@example.invalid`;

// Assert a set of field paths exist (and are not undefined) on an object.
const hasFields = (obj, paths) => {
  const missing = paths.filter((p) => {
    const value = p.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
    return value === undefined;
  });
  return missing;
};

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
  ids.users.push(user.id);
  return user;
};

const login = async (email) => (await (await fetch(`${BASE}/users/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: PASSWORD }),
})).json()).token;

const auth = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

try {
  await sequelize.authenticate();

  const academic = await makeUser("Academic", mail("academic"), "academic_supervisor");
  const professional = await makeUser("Professional", mail("professional"), "professional_supervisor");
  const studentUser = await makeUser("Ui Student", mail("student"), "student");
  const student = await Student.create({ userId: studentUser.id, matricule: `M-${TAG}`, class: "UI Contract" });
  ids.students.push(student.id);
  await Internship.create({
    studentId: student.id,
    academicSupervisorId: academic.id,
    professionalSupervisorId: professional.id,
    company: "Acme",
  });

  const studentToken = await login(studentUser.email);
  const academicToken = await login(academic.email);
  const professionalToken = await login(professional.email);

  const dir = path.join(process.cwd(), "uploads");
  const pdf = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith(".pdf"));
  const form = new FormData();
  form.append("title", "UI Contract Report");
  form.append("report", new Blob([fs.readFileSync(path.join(dir, pdf))], { type: "application/pdf" }), "ui-contract.pdf");
  const upload = await (await fetch(`${BASE}/students/reports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
    body: form,
  })).json();
  const reportId = upload.report.id;
  ids.reports.push(reportId);

  await fetch(`${BASE}/students/reports/${reportId}/request-submission`, {
    method: "POST",
    headers: auth(studentToken),
  });

  // --- SubmissionStatusPanel reads -----------------------------------------
  const status = await (await fetch(`${BASE}/students/reports/${reportId}/submission-status`, {
    headers: auth(studentToken),
  })).json();

  const statusMissing = hasFields(status, [
    "reportId",
    "title",
    "status",
    "cycle",
    "reviews",
    "academicApproved",
    "professionalApproved",
    "readyForFinalSubmission",
    "canRequestSubmission",
    "blockingIssues",
    "locked",
  ]);
  check("submission-status returns every field the panel reads", statusMissing.length === 0, statusMissing.join(", "));

  check("review rows carry a supervisorType the panel labels", status.reviews?.every((r) => r.supervisorType === "academic" || r.supervisorType === "professional"));
  check("review rows carry a status the panel maps to an icon", status.reviews?.every((r) => ["pending", "approved", "rejected", "cancelled"].includes(r.status)));
  check("panel renders one row per supervisor", status.reviews?.length === 2, `n=${status.reviews?.length}`);
  check("blockingIssues is an array the panel can map", Array.isArray(status.blockingIssues));
  check("locked is a boolean the panel can branch on", typeof status.locked === "boolean");
  check("canRequestSubmission is a boolean", typeof status.canRequestSubmission === "boolean");
  check(
    "no confidential field leaks into the panel's payload",
    !JSON.stringify(status).includes("privateMark") && !JSON.stringify(status).includes("privateComments")
  );

  // --- SupervisorReviews queue reads ---------------------------------------
  const queue = await (await fetch(`${BASE}/reviews/pending`, { headers: auth(academicToken) })).json();

  check("pending queue returns a reviews array", Array.isArray(queue.reviews));
  check("queue exposes the review id used for approve/reject", Number.isInteger(queue.reviews?.[0]?.id));

  const entry = queue.reviews?.[0];
  const queueMissing = hasFields(entry, [
    "id",
    "supervisorType",
    "status",
    "report.title",
    "report.student.name",
    "report.student.matricule",
    "report.student.class",
    "version.versionNumber",
    "version.fileName",
    "version.fileUrl",
  ]);
  check("queue entry returns every field the page reads", queueMissing.length === 0, queueMissing.join(", "));
  check("version.fileUrl is an absolute-path fragment the Open PDF link can use", String(entry?.version?.fileUrl).startsWith("/uploads/"), entry?.version?.fileUrl);
  check("requestedAt is parseable by Date", !Number.isNaN(new Date(entry?.requestedAt).getTime()));

  // The professional capacity must see the same report under its own review row.
  const profQueue = await (await fetch(`${BASE}/reviews/pending`, { headers: auth(professionalToken) })).json();
  check("the other capacity sees its own row for the same report", profQueue.reviews?.[0]?.report?.id === reportId);
  check("the two rows are distinct", profQueue.reviews?.[0]?.id !== entry?.id);
  check(
    "each row is labelled with its own capacity",
    entry?.supervisorType === "academic" && profQueue.reviews?.[0]?.supervisorType === "professional"
  );

  // --- after both approve, the panel's final-submit branch -----------------
  // Approval is gated on the existing rubric grade: approving a report IS
  // submitting the supervision grade, so both must be recorded first.
  await Internship.update(
    {
      academicGrade: 15,
      academicGradeStatus: "submitted",
      academicGradeSubmittedAt: new Date(),
      professionalGrade: 8,
      professionalGradeStatus: "submitted",
      professionalGradeSubmittedAt: new Date(),
    },
    { where: { studentId: student.id } }
  );

  await fetch(`${BASE}/reviews/${entry.id}/approve`, { method: "POST", headers: auth(academicToken) });
  await fetch(`${BASE}/reviews/${profQueue.reviews[0].id}/approve`, { method: "POST", headers: auth(professionalToken) });

  const ready = await (await fetch(`${BASE}/students/reports/${reportId}/submission-status`, {
    headers: auth(studentToken),
  })).json();
  check("panel sees readyForFinalSubmission after both approvals", ready.readyForFinalSubmission === true);
  check("panel sees both approvals individually", ready.academicApproved === true && ready.professionalApproved === true);

  const finalRes = await (await fetch(`${BASE}/students/reports/${reportId}/final-submit`, {
    method: "POST",
    headers: auth(studentToken),
    body: JSON.stringify({ acceptedPlagiarismScore: null }),
  })).json();
  check("final-submit returns finalSubmittedAt the panel displays", Boolean(finalRes.finalSubmittedAt), finalRes.finalSubmittedAt);

  const locked = await (await fetch(`${BASE}/students/reports/${reportId}/submission-status`, {
    headers: auth(studentToken),
  })).json();
  check("panel sees the archived state", locked.locked === true && Boolean(locked.finalSubmittedAt));
  check("panel hides the action buttons once locked", locked.locked === true);

  // --- ReportLibrary page reads -------------------------------------------
  // The report was finalised above, so it is archived and discoverable.
  const library = await (await fetch(`${BASE}/library/reports`, { headers: auth(studentToken) })).json();
  const libraryEntry = library.entries?.find((e) => e.title === "UI Contract Report");

  check("the archived report appears in the library listing", Boolean(libraryEntry), `n=${library.entries?.length}`);

  const entryMissing = hasFields(libraryEntry, [
    "id",
    "title",
    "keywords",
    "academicYear",
    "program",
    "companyName",
    "internshipDomain",
    "submissionDate",
    "visibility",
    "canViewFullText",
    "student.name",
    "supervisors",
    "ownedByMe",
  ]);
  check("a library card returns every field the page reads", entryMissing.length === 0, entryMissing.join(", "));
  check("keywords is an array the card can map", Array.isArray(libraryEntry?.keywords));
  check("the owner is told the entry is theirs", libraryEntry?.ownedByMe === true);
  check("the owner may open their own document", libraryEntry?.canViewFullText === true);

  const facetsResponse = await (await fetch(`${BASE}/library/facets`, { headers: auth(studentToken) })).json();
  const facetsMissing = hasFields(facetsResponse, ["academicYears", "programs", "companies", "domains"]);
  check("facets returns all four filter lists the page binds to", facetsMissing.length === 0, facetsMissing.join(", "));

  const detail = await (await fetch(`${BASE}/library/reports/${libraryEntry.id}`, { headers: auth(studentToken) })).json();
  check("the detail panel receives the entry", Boolean(detail.entry));
  check("an owner sees the document location to open it", Boolean(detail.entry?.fileUrl), detail.entry?.fileName);
  check("the detail panel is told whether it may offer the open button", typeof detail.entry?.canViewFullText === "boolean");

  // --- queue empties once reviewed ----------------------------------------
  const afterQueue = await (await fetch(`${BASE}/reviews/pending`, { headers: auth(academicToken) })).json();
  check("the queue no longer lists a decided review", afterQueue.reviews?.length === 0, `n=${afterQueue.reviews?.length}`);

  console.log(`\n${failures === 0 ? "ALL UI CONTRACT CHECKS PASSED" : `${failures} UI CONTRACT CHECK(S) FAILED`}`);
} catch (error) {
  failures++;
  console.error("UI CONTRACT VERIFICATION ERROR:", error);
} finally {
  try {
    const reportIds = ids.reports.filter(Number.isInteger);
    if (reportIds.length) {
      const where = { reportId: reportIds };
      await ReportAudit.destroy({ where });
      await ReportSubmission.destroy({ where });
      await ReportReview.destroy({ where });
      await ReportVersion.destroy({ where });
      await Report.destroy({ where: { id: reportIds } });
    }
    await Internship.destroy({ where: { studentId: ids.students } });
    await Notification.destroy({ where: { userId: ids.users } });
    await Student.destroy({ where: { id: ids.students } });
    await User.destroy({ where: { id: ids.users } });
    console.log(`cleanup: removed ${ids.users.length} users, ${ids.students.length} students, ${reportIds.length} reports`);
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
}
