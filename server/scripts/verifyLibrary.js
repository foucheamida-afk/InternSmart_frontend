// Temporary end-to-end verification of the virtual library (§4.12 phase 3).
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
import LibraryEntry from "../models/libraryEntryModel.js";
import Notification from "../models/notificationModel.js";
// Must be imported: several foreign keys (notably `Report.studentId`) are not
// declared on the model itself, only by the associations. Without this the
// attribute is absent from the model, so `report.studentId` reads as undefined
// and any query built from it fails - even though the column exists and the
// server process (which does import this) sees it fine.
import "../models/association.js";
import { academicYearFor, normalizeAcademicYear } from "../utils/academicYear.js";

const BASE = "http://localhost:3000/api";
const TAG = `lib${Date.now()}`;
const PASSWORD = "VerifyPass123!";

const ids = { users: [], students: [], reports: [] };
let failures = 0;

const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mail = (n) => `${TAG}-${n}@example.invalid`;

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

const login = async (email) => {
  const res = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await res.json()).token;
};

const auth = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

const fixture = (() => {
  const dir = path.join(process.cwd(), "uploads");
  const pdf = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith(".pdf"));
  return path.join(dir, pdf);
})();

const upload = async (token, title) => {
  const form = new FormData();
  form.append("title", title);
  form.append("report", new Blob([fs.readFileSync(fixture)], { type: "application/pdf" }), "lib.pdf");
  const res = await fetch(`${BASE}/students/reports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return (await res.json()).report;
};

try {
  await sequelize.authenticate();

  // --- pure helpers --------------------------------------------------------
  check("academic year starts in September by default", academicYearFor(new Date("2025-10-01")) === "2025/2026", academicYearFor(new Date("2025-10-01")));
  check("a summer date belongs to the year that began the previous September", academicYearFor(new Date("2026-06-15")) === "2025/2026", academicYearFor(new Date("2026-06-15")));
  check("August is still the previous academic year", academicYearFor(new Date("2026-08-31")) === "2025/2026");
  check("September rolls to the new academic year", academicYearFor(new Date("2026-09-01")) === "2026/2027");
  check("an invalid date yields null rather than a wrong year", academicYearFor("not-a-date") === null);
  check("normalises 2025-2026", normalizeAcademicYear("2025-2026") === "2025/2026");
  check("normalises a bare year", normalizeAcademicYear("2025") === "2025/2026");
  check("rejects a non-consecutive range", normalizeAcademicYear("2025/2029") === null);
  check("rejects nonsense", normalizeAcademicYear("last year") === null);

  // --- actors --------------------------------------------------------------
  const academic = await makeUser("Acad", mail("academic"), "academic_supervisor");
  const professional = await makeUser("Prof", mail("professional"), "professional_supervisor");
  const admin = await makeUser("Admin", mail("admin"), "admin");

  const academicToken = await login(academic.email);
  const professionalToken = await login(professional.email);
  const adminToken = await login(admin.email);

  const buildStudent = async (label, { academicYear = null, company = "Acme", domain = "Software" } = {}) => {
    const user = await makeUser(`${label} Student`, mail(`${label}-student`), "student");
    const student = await Student.create({ userId: user.id, matricule: `M-${TAG}-${label}`, class: "Software Engineering" });
    ids.students.push(student.id);
    await Internship.create({
      studentId: student.id,
      academicSupervisorId: academic.id,
      professionalSupervisorId: professional.id,
      company,
      academicYear,
      program: "Software Engineering",
      internshipDomain: domain,
    });
    const token = await login(user.email);
    return { user, student, token, auth: auth(token) };
  };

  // Drive a report all the way to final submission so it is archived.
  const completeSubmission = async (ctx, title) => {
    const report = await upload(ctx.token, title);
    ids.reports.push(report.id);

    await fetch(`${BASE}/students/reports/${report.id}/request-submission`, { method: "POST", headers: ctx.auth });

    const queue = await (await fetch(`${BASE}/reviews/pending`, { headers: auth(academicToken) })).json();
    const aReview = queue.reviews.find((r) => r.report?.id === report.id);
    const pQueue = await (await fetch(`${BASE}/reviews/pending`, { headers: auth(professionalToken) })).json();
    const pReview = pQueue.reviews.find((r) => r.report?.id === report.id);

    // Approval is gated on the existing rubric grade: approving a report IS
    // submitting the supervision grade.
    await Internship.update(
      {
        academicGrade: 15,
        academicGradeStatus: "submitted",
        academicGradeSubmittedAt: new Date(),
        professionalGrade: 8,
        professionalGradeStatus: "submitted",
        professionalGradeSubmittedAt: new Date(),
      },
      { where: { studentId: ctx.student.id } }
    );

    await fetch(`${BASE}/reviews/${aReview.id}/approve`, { method: "POST", headers: auth(academicToken) });
    await fetch(`${BASE}/reviews/${pReview.id}/approve`, { method: "POST", headers: auth(professionalToken) });
    await fetch(`${BASE}/students/reports/${report.id}/final-submit`, { method: "POST", headers: ctx.auth });

    return report;
  };

  const alice = await buildStudent("alice", { academicYear: "2024/2025", company: "Globex", domain: "Fintech" });
  const bob = await buildStudent("bob", { academicYear: null, company: "Initech", domain: "Logistics" });

  const aliceReport = await completeSubmission(alice, "Alice Report");
  const bobReport = await completeSubmission(bob, "Bob Report");

  // --- auto-archive --------------------------------------------------------
  const aliceEntry = await LibraryEntry.findOne({ where: { reportId: aliceReport.id } });
  const bobEntry = await LibraryEntry.findOne({ where: { reportId: bobReport.id } });

  check("final submission archives the report automatically", Boolean(aliceEntry));
  check("the archive stores the internship's explicit academic year", aliceEntry?.academicYear === "2024/2025", aliceEntry?.academicYear);
  check("a missing academic year is derived from the submission date", /^\d{4}\/\d{4}$/.test(String(bobEntry?.academicYear)), bobEntry?.academicYear);
  check("the company is snapshotted", aliceEntry?.companyName === "Globex", aliceEntry?.companyName);
  check("the domain is snapshotted", aliceEntry?.internshipDomain === "Fintech");
  check("the programme is snapshotted", aliceEntry?.program === "Software Engineering");
  check("the class is snapshotted", aliceEntry?.classLevel === "Software Engineering");
  check("the file hash is carried into the archive", Boolean(aliceEntry?.fileHash), aliceEntry?.fileHash?.slice(0, 12));
  check("both supervisors are recorded on the entry", aliceEntry?.academicSupervisorId === academic.id && aliceEntry?.professionalSupervisorId === professional.id);
  check("the default visibility is institution", aliceEntry?.visibility === "institution", aliceEntry?.visibility);

  const audits = await ReportAudit.findAll({ where: { reportId: aliceReport.id } });
  check("the archive action is in the audit trail", audits.some((a) => a.action === "archived_to_library"), audits.map((a) => a.action).join(","));

  // Idempotency: re-running the archive must not duplicate the entry.
  const before = await LibraryEntry.count();
  const { archiveFinalReport } = await import("../services/libraryService.js");
  const reloaded = await Report.findByPk(aliceReport.id);
  const version = await ReportVersion.findByPk(reloaded.currentVersionId);
  await archiveFinalReport({
    report: reloaded,
    version,
    student: alice.student,
  });
  check("archiving the same version twice does not duplicate it", (await LibraryEntry.count()) === before, `count=${await LibraryEntry.count()}`);

  // --- search --------------------------------------------------------------
  const searchAs = async (token, query = "") => {
    const res = await fetch(`${BASE}/library/reports${query}`, { headers: auth(token) });
    return { status: res.status, data: await res.json() };
  };

  const adminSearch = await searchAs(adminToken);
  check("an administrator can search the library", adminSearch.status === 200, `status=${adminSearch.status}`);
  check("both archived reports are listed for an administrator", adminSearch.data.total >= 2, `total=${adminSearch.data.total}`);

  const titleSearch = await searchAs(adminToken, `?q=${encodeURIComponent("Alice Report")}`);
  check("search matches on title", titleSearch.data.entries.some((e) => e.title === "Alice Report"), `n=${titleSearch.data.entries.length}`);

  const yearSearch = await searchAs(adminToken, "?academicYear=2024/2025");
  check("search filters by academic year", yearSearch.data.entries.length >= 1 && yearSearch.data.entries.every((e) => e.academicYear === "2024/2025"));

  const companySearch = await searchAs(adminToken, "?company=Globex");
  check("search filters by company", companySearch.data.entries.some((e) => e.companyName === "Globex"));

  const facets = await (await fetch(`${BASE}/library/facets`, { headers: auth(adminToken) })).json();
  check("facets expose the academic years present", Array.isArray(facets.academicYears) && facets.academicYears.includes("2024/2025"), JSON.stringify(facets.academicYears));
  check("facets expose companies", Array.isArray(facets.companies) && facets.companies.includes("Globex"));

  // --- access tiers --------------------------------------------------------
  const bobSearch = await searchAs(bob.token);
  const bobSeesAlice = bobSearch.data.entries.find((e) => e.title === "Alice Report");
  check("another student can discover an institution-tier report", Boolean(bobSeesAlice));
  check("a student's listing omits the file location", bobSeesAlice?.fileUrl === undefined && bobSeesAlice?.fileName === undefined);
  check("a student's listing omits the plagiarism scores", bobSeesAlice?.finalPlagiarismScore === undefined && bobSeesAlice?.plagiarismStatus === undefined);
  check("a student's listing marks whether they own it", bobSeesAlice?.ownedByMe === false);

  const bobDetail = await (await fetch(`${BASE}/library/reports/${aliceEntry.id}`, { headers: auth(bob.token) })).json();
  check("a student can read the metadata of another student's archived report", Boolean(bobDetail.entry?.title));
  check("the metadata shows the academic year, so reuse is attributable", bobDetail.entry?.academicYear === "2024/2025");
  check("the detail payload still omits the file location", bobDetail.entry?.fileUrl === undefined);

  const bobPreview = await fetch(`${BASE}/library/reports/${aliceEntry.id}/preview`, { headers: auth(bob.token) });
  const bobPreviewData = await bobPreview.json();
  check("a student cannot open the full text at institution tier", bobPreview.status === 403, `status=${bobPreview.status}`);
  check("the refusal explains why", bobPreviewData.code === "FULL_TEXT_RESTRICTED", bobPreviewData.code);

  const aliceOwn = await (await fetch(`${BASE}/library/reports/${aliceEntry.id}/preview`, { headers: alice.auth })).json();
  check("the owning student can open their own archived report", Boolean(aliceOwn.fileUrl), aliceOwn.fileName);

  const supDetail = await (await fetch(`${BASE}/library/reports/${aliceEntry.id}`, { headers: auth(academicToken) })).json();
  check("a supervisor sees the full metadata", Boolean(supDetail.entry?.fileUrl));
  check("a supervisor sees the plagiarism fields", "finalPlagiarismScore" in (supDetail.entry || {}));

  const supPreview = await fetch(`${BASE}/library/reports/${aliceEntry.id}/preview`, { headers: auth(academicToken) });
  check("a supervisor can open a library document", supPreview.status === 200, `status=${supPreview.status}`);

  // --- visibility ----------------------------------------------------------
  const setVisibility = async (token, id, visibility) => {
    const res = await fetch(`${BASE}/library/reports/${id}/visibility`, {
      method: "PUT",
      headers: auth(token),
      body: JSON.stringify({ visibility }),
    });
    return { status: res.status, data: await res.json() };
  };

  const studentPublic = await setVisibility(alice.token, aliceEntry.id, "public");
  check("a student cannot publish publicly", studentPublic.status === 403, `status=${studentPublic.status}`);
  check("the refusal says an administrator must do it", studentPublic.data.code === "PUBLIC_REQUIRES_ADMIN");

  const bobCannotSet = await setVisibility(bob.token, aliceEntry.id, "private");
  check("another student cannot change visibility", bobCannotSet.status === 403, `status=${bobCannotSet.status}`);

  const badValue = await setVisibility(alice.token, aliceEntry.id, "everyone");
  check("an invalid visibility value is rejected", badValue.status === 400, `status=${badValue.status}`);

  const withdrawn = await setVisibility(alice.token, aliceEntry.id, "private");
  check("the owner can withdraw to private", withdrawn.status === 200, `status=${withdrawn.status}`);

  const bobAfterPrivate = await searchAs(bob.token, `?q=${encodeURIComponent("Alice Report")}`);
  check("a private entry disappears from another student's search", !bobAfterPrivate.data.entries.some((e) => e.title === "Alice Report"));

  const bobPrivateDetail = await fetch(`${BASE}/library/reports/${aliceEntry.id}`, { headers: auth(bob.token) });
  check("a private entry is a 404 for another student, not a 403", bobPrivateDetail.status === 404, `status=${bobPrivateDetail.status}`);

  const supAfterPrivate = await fetch(`${BASE}/library/reports/${aliceEntry.id}`, { headers: auth(academicToken) });
  check("a supervisor assigned to the report still sees it when private", supAfterPrivate.status === 200, `status=${supAfterPrivate.status}`);

  const adminPublishes = await setVisibility(adminToken, aliceEntry.id, "public");
  check("an administrator can publish publicly", adminPublishes.status === 200, `status=${adminPublishes.status}`);

  const bobPreviewPublic = await fetch(`${BASE}/library/reports/${aliceEntry.id}/preview`, { headers: auth(bob.token) });
  check("at public tier another student can open the document", bobPreviewPublic.status === 200, `status=${bobPreviewPublic.status}`);

  // --- author-supplied metadata (abstract + keywords) ----------------------
  // Without this, keyword and abstract search matched nothing: every entry had
  // both fields null, so a topic could only be found by its exact title.
  const setDetails = async (token, id, details) => {
    const res = await fetch(`${BASE}/library/reports/${id}/details`, {
      method: "PUT",
      headers: auth(token),
      body: JSON.stringify(details),
    });
    return { status: res.status, data: await res.json() };
  };

  const saved = await setDetails(alice.token, aliceEntry.id, {
    abstract: "A study of distributed telemetry ingestion with bounded latency.",
    keywords: "telemetry, Kafka, backpressure, telemetry",
  });
  check("the owner can set an abstract and keywords", saved.status === 200, `status=${saved.status}`);
  check("duplicate keywords are collapsed", saved.data.entry?.keywords?.length === 3, JSON.stringify(saved.data.entry?.keywords));
  check("the abstract is stored", String(saved.data.entry?.abstract).includes("distributed telemetry"));

  const bobCannotEdit = await setDetails(bob.token, aliceEntry.id, { abstract: "hijacked" });
  check("another student cannot edit the entry", bobCannotEdit.status === 403, `status=${bobCannotEdit.status}`);

  const adminCanEdit = await setDetails(adminToken, aliceEntry.id, { keywords: "telemetry, ingestion" });
  check("an administrator can correct the metadata", adminCanEdit.status === 200, `status=${adminCanEdit.status}`);

  const emptyUpdate = await setDetails(alice.token, aliceEntry.id, {});
  check("an empty update is refused", emptyUpdate.status === 400, `status=${emptyUpdate.status}`);

  // Now the search that was previously dead actually finds it.
  const keywordSearch = await searchAs(adminToken, "?q=backpressure");
  check("keyword search now finds the entry", keywordSearch.data.entries.some((e) => e.title === "Alice Report"), `n=${keywordSearch.data.entries.length}`);

  const abstractSearch = await searchAs(adminToken, "?q=bounded%20latency");
  check("abstract search finds the entry", abstractSearch.data.entries.some((e) => e.title === "Alice Report"), `n=${abstractSearch.data.entries.length}`);

  // The metadata a student can read is the abstract, not the document.
  //
  // The entry is returned to the default tier first: an earlier check published
  // it to `public`, and at that tier a student is *entitled* to the file
  // location, so asserting on it there would be asserting the wrong rule.
  await setVisibility(alice.token, aliceEntry.id, "institution");

  const bobSeesAbstract = await searchAs(bob.token, "?q=backpressure");
  const bobVisibleEntry = bobSeesAbstract.data.entries.find((e) => e.title === "Alice Report");
  check("another student can discover it by keyword", Boolean(bobVisibleEntry), `n=${bobSeesAbstract.data.entries.length}`);
  check("and can read the abstract that makes it discoverable", Boolean(bobVisibleEntry?.abstract));
  check(
    "but still receives no file location at the default institution tier",
    bobVisibleEntry?.fileUrl === undefined && bobVisibleEntry?.canViewFullText === false,
    `fileUrl=${bobVisibleEntry?.fileUrl} canViewFullText=${bobVisibleEntry?.canViewFullText}`
  );

  console.log(`\n${failures === 0 ? "ALL LIBRARY CHECKS PASSED" : `${failures} LIBRARY CHECK(S) FAILED`}`);
} catch (error) {
  failures++;
  console.error("LIBRARY VERIFICATION ERROR:", error);
} finally {
  try {
    const reportIds = ids.reports.filter(Number.isInteger);
    if (reportIds.length) {
      await LibraryEntry.destroy({ where: { reportId: reportIds } });
      await ReportAudit.destroy({ where: { reportId: reportIds } });
      await ReportSubmission.destroy({ where: { reportId: reportIds } });
      await ReportReview.destroy({ where: { reportId: reportIds } });
      await ReportVersion.destroy({ where: { reportId: reportIds } });
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
