// Temporary end-to-end verification of the two-stage report submission workflow.
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
const TAG = `vrf${Date.now()}`;
const PASSWORD = "VerifyPass123!";

const ids = { users: [], students: [], reports: [] };
let failures = 0;

const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mail = (n) => `${TAG}-${n}@example.invalid`;

const makeUser = async (name, email, role, extras = {}) => {
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(PASSWORD, 10),
    role,
    mustChangePassword: false,
    active: true,
    onboardingCompletedAt: role.includes("supervisor") ? new Date() : null,
    ...extras,
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
  const data = await res.json();
  return { status: res.status, token: data.token, data };
};

const auth = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

// A real PDF from the project's uploads directory, so the upload path runs its
// genuine MIME + extension checks rather than being bypassed.
const fixturePath = (() => {
  const dir = path.join(process.cwd(), "uploads");
  const pdf = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith(".pdf"));
  if (!pdf) throw new Error("no PDF fixture available in server/uploads");
  return path.join(dir, pdf);
})();

const uploadReport = async (token, title) => {
  const form = new FormData();
  form.append("title", title);
  form.append(
    "report",
    new Blob([fs.readFileSync(fixturePath)], { type: "application/pdf" }),
    `${title.replace(/\s+/g, "-")}.pdf`
  );
  const res = await fetch(`${BASE}/students/reports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, data: await res.json() };
};

const buildStudent = async (label) => {
  const user = await makeUser(`${label} Student`, mail(`${label}-student`), "student");
  const student = await Student.create({
    userId: user.id,
    matricule: `M-${TAG}-${label}`,
    class: "Verification",
  });
  ids.students.push(student.id);
  return { user, student };
};

try {
  await sequelize.authenticate();

  const academic = await makeUser("Academic Sup", mail("academic"), "academic_supervisor");
  const professional = await makeUser("Professional Sup", mail("professional"), "professional_supervisor");
  const outsider = await makeUser("Outsider Sup", mail("outsider"), "academic_supervisor");
  const admin = await makeUser("Admin", mail("admin"), "admin");

  const academicAuth = auth((await login(academic.email)).token);
  const professionalAuth = auth((await login(professional.email)).token);
  const outsiderAuth = auth((await login(outsider.email)).token);

  const a = await buildStudent("alpha");
  await Internship.create({
    studentId: a.student.id,
    academicSupervisorId: academic.id,
    professionalSupervisorId: professional.id,
    company: "Acme",
  });
  const alphaToken = (await login(a.user.email)).token;
  const alphaAuth = auth(alphaToken);

  // ---------- upload ----------
  const up1 = await uploadReport(alphaToken, "Alpha Report");
  check("student uploads a report", up1.status === 201, `status=${up1.status}`);
  const reportId = up1.data.report?.id;
  ids.reports.push(reportId);
  check("a version row is created with a hash", Boolean(up1.data.version?.fileHash), up1.data.version?.fileHash?.slice(0, 12));

  const alphaAuth2 = alphaAuth;

  const before = await (await fetch(`${BASE}/students/reports/${reportId}/submission-status`, { headers: alphaAuth2 })).json();
  check("status endpoint reachable before any review", Number.isInteger(before.reportId) && before.reportId === reportId, `reportId=${before.reportId}`);
  check("no reviews exist yet", Array.isArray(before.reviews) && before.reviews.length === 0);
  check("submission can be requested", before.canRequestSubmission === true, JSON.stringify(before.blockingIssues));

  // ---------- request submission ----------
  const req1 = await fetch(`${BASE}/students/reports/${reportId}/request-submission`, {
    method: "POST",
    headers: alphaAuth2,
  });
  const req1Data = await req1.json();
  check("request-submission succeeds", req1.status === 201, `status=${req1.status} ${req1Data.message || ""}`);
  check("a review cycle is opened", req1Data.cycle === 1, `cycle=${req1Data.cycle}`);

  const reviewRows = await ReportReview.findAll({ where: { reportId } });
  check("one review row per supervisor", reviewRows.length === 2, `rows=${reviewRows.length}`);
  check("both reviews start pending", reviewRows.every((r) => r.status === "pending"));
  check("reviews are bound to the uploaded version", reviewRows.every((r) => r.reportVersionId === up1.data.version.id));

  const supaNotes = await Notification.count({ where: { userId: academic.id } });
  const suppNotes = await Notification.count({ where: { userId: professional.id } });
  check("academic supervisor was notified", supaNotes >= 1, `notes=${supaNotes}`);
  check("professional supervisor was notified", suppNotes >= 1, `notes=${suppNotes}`);

  const rerequest = await fetch(`${BASE}/students/reports/${reportId}/request-submission`, {
    method: "POST",
    headers: alphaAuth2,
  });
  check("a second request while pending is refused", rerequest.status === 409, `status=${rerequest.status}`);

  // ---------- supervisor queue ----------
  const pending = await (await fetch(`${BASE}/reviews/pending`, { headers: academicAuth })).json();
  check("academic supervisor sees the pending review", pending.reviews?.length === 1, `n=${pending.reviews?.length}`);
  check("queue exposes the file to review", Boolean(pending.reviews?.[0]?.version?.fileUrl), pending.reviews?.[0]?.version?.fileName);

  const profPending = await (await fetch(`${BASE}/reviews/pending`, { headers: professionalAuth })).json();
  check("professional supervisor sees the same report as their own review", profPending.reviews?.length === 1);
  check("the two queues hold different review rows", pending.reviews?.[0]?.id !== profPending.reviews?.[0]?.id);

  const outsiderPending = await (await fetch(`${BASE}/reviews/pending`, { headers: outsiderAuth })).json();
  check("an unassigned supervisor sees nothing", outsiderPending.reviews?.length === 0);

  const academicReviewId = pending.reviews[0].id;

  // Rule 2: a supervisor cannot act on a report that is not assigned to them.
  const outsiderApprove = await fetch(`${BASE}/reviews/${academicReviewId}/approve`, {
    method: "POST",
    headers: outsiderAuth,
  });
  check("an unassigned supervisor cannot approve (rule 2)", outsiderApprove.status === 403, `status=${outsiderApprove.status}`);

  const outsiderDetail = await fetch(`${BASE}/reviews/${academicReviewId}`, { headers: outsiderAuth });
  check("an unassigned supervisor cannot read the review", outsiderDetail.status === 404, `status=${outsiderDetail.status}`);

  // Rule 9: confidential review data must never reach a student-facing payload.
  //
  // `privateMark` no longer exists - the product decision is that approving a
  // report IS the existing rubric grade - so the confidential field to guard is
  // the reviewer's private comments.
  await ReportReview.update(
    { privateComments: "confidential remark" },
    { where: { id: academicReviewId } }
  );
  const custStatus = await (await fetch(`${BASE}/students/reports/${reportId}/submission-status`, { headers: alphaAuth2 })).json();
  const statusBlob = JSON.stringify(custStatus);
  check("student status hides privateComments (rule 9)", !statusBlob.includes("privateComments") && !statusBlob.includes("confidential remark"));
  check("student status does not expose a dropped privateMark field", !statusBlob.includes("privateMark"));
  check("student status still shows the approval state", custStatus.reviews?.length === 2 && custStatus.reviews.every((r) => r.status === "pending"));

  // ---------- approvals ----------
  // --- approval is gated on the existing rubric grade ----------------------
  // The product decision: approving a report IS submitting the supervision
  // grade. There is no separate confidential mark, so an approval with no grade
  // behind it must be refused rather than recorded as a bare verdict.
  const approveWithoutGrade = await fetch(`${BASE}/reviews/${academicReviewId}/approve`, { method: "POST", headers: academicAuth });
  const approveWithoutGradeData = await approveWithoutGrade.json();
  check(
    "approving without a submitted rubric grade is refused",
    approveWithoutGrade.status === 409,
    `status=${approveWithoutGrade.status}`
  );
  check(
    "the refusal names the missing rubric",
    approveWithoutGradeData.code === "RUBRIC_REQUIRED",
    approveWithoutGradeData.code
  );
  check(
    "the refusal explains that approval confirms the grade",
    /confirm/i.test(approveWithoutGradeData.message || ""),
    approveWithoutGradeData.message
  );

  // Now submit the grades, exactly as the existing rubric endpoints would.
  await Internship.update(
    { academicGrade: 15, academicGradeStatus: "submitted", academicGradeSubmittedAt: new Date() },
    { where: { studentId: a.student.id } }
  );

  const appr1 = await fetch(`${BASE}/reviews/${academicReviewId}/approve`, {
    method: "POST",
    headers: academicAuth,
    body: JSON.stringify({ privateComments: "Confirmed against the rubric." }),
  });
  const appr1Data = await appr1.json();
  check("academic supervisor approves", appr1.status === 200, `status=${appr1.status}`);
  check("the approval reports the grade it confirmed", appr1Data.confirmedGrade === 15, String(appr1Data.confirmedGrade));
  check("report awaits the second approval", appr1Data.reportStatus === "approved_by_one_supervisor", appr1Data.reportStatus);

  const academicReviewRow = await ReportReview.findByPk(academicReviewId);
  check(
    "the review records the grade its approval was based on",
    academicReviewRow?.gradeSnapshot?.grade === 15,
    JSON.stringify(academicReviewRow?.gradeSnapshot)
  );
  check("the snapshot records the scale that grade belongs to", academicReviewRow?.gradeSnapshot?.scale === 20, String(academicReviewRow?.gradeSnapshot?.scale));
  check(
    "confidential notes supplied at approval are stored",
    academicReviewRow?.privateComments === "Confirmed against the rubric.",
    String(academicReviewRow?.privateComments)
  );

  const supervisorView = await (await fetch(`${BASE}/reviews/${academicReviewId}`, { headers: academicAuth })).json();
  check(
    "the supervisor can read back their own confidential notes",
    supervisorView.review?.privateComments === "Confirmed against the rubric.",
    String(supervisorView.review?.privateComments)
  );
  check(
    "and can see the grade their approval was based on",
    supervisorView.review?.gradeSnapshot?.grade === 15,
    JSON.stringify(supervisorView.review?.gradeSnapshot)
  );

  const studentVerdictView = await (await fetch(`${BASE}/students/reports/${reportId}/submission-status`, { headers: alphaAuth2 })).json();
  check(
    "the student never receives those confidential notes",
    !JSON.stringify(studentVerdictView).includes("Confirmed against the rubric")
  );

  const doubleApprove = await fetch(`${BASE}/reviews/${academicReviewId}/approve`, { method: "POST", headers: academicAuth });
  check("a decided review cannot be re-approved", doubleApprove.status === 409, `status=${doubleApprove.status}`);

  // Rule 3: never with only one approval.
  const earlyFinal = await fetch(`${BASE}/students/reports/${reportId}/final-submit`, {
    method: "POST",
    headers: alphaAuth2,
  });
  const earlyFinalData = await earlyFinal.json();
  check("final submission blocked with one approval (rule 3)", earlyFinal.status === 409, `status=${earlyFinal.status}`);
  check("the refusal names the outstanding reviewer", earlyFinalData.code === "APPROVALS_INCOMPLETE", earlyFinalData.code);

  const professionalReviewId = profPending.reviews[0].id;

  const approveProfessionalWithoutGrade = await fetch(`${BASE}/reviews/${professionalReviewId}/approve`, { method: "POST", headers: professionalAuth });
  check("the professional half is gated the same way", approveProfessionalWithoutGrade.status === 409, `status=${approveProfessionalWithoutGrade.status}`);

  await Internship.update(
    { professionalGrade: 8, professionalGradeStatus: "submitted", professionalGradeSubmittedAt: new Date() },
    { where: { studentId: a.student.id } }
  );

  const appr2 = await fetch(`${BASE}/reviews/${professionalReviewId}/approve`, { method: "POST", headers: professionalAuth });
  const appr2Data = await appr2.json();
  check("professional supervisor approves", appr2.status === 200, `status=${appr2.status}`);
  check("report becomes ready for final submission", appr2Data.reportStatus === "ready_for_final_submission", appr2Data.reportStatus);

  const readyStatus = await (await fetch(`${BASE}/students/reports/${reportId}/submission-status`, { headers: alphaAuth2 })).json();
  check("student is told final submission is available", readyStatus.readyForFinalSubmission === true, JSON.stringify(readyStatus.blockingIssues));

  // ---------- final submission ----------
  const final = await fetch(`${BASE}/students/reports/${reportId}/final-submit`, {
    method: "POST",
    headers: alphaAuth2,
    body: JSON.stringify({ acceptedPlagiarismScore: 12.5 }),
  });
  const finalData = await final.json();
  check("final submission succeeds", final.status === 200, `status=${final.status} ${finalData.message || ""}`);
  check("a permanent file hash is recorded (rule 7)", Boolean(finalData.fileHash), finalData.fileHash?.slice(0, 12));

  const lockedReport = await Report.findByPk(reportId);
  check("report is locked (rule 6)", Boolean(lockedReport.lockedAt));
  check("report status is final_submitted", lockedReport.status === "final_submitted", lockedReport.status);

  const submissionRow = await ReportSubmission.findOne({ where: { reportId } });
  check("a submission record exists", Boolean(submissionRow));
  check("submission record carries the hash (rule 7)", submissionRow?.fileHash === finalData.fileHash);
  check("submission records the accepted score", submissionRow?.acceptedPlagiarismScore === 12.5, String(submissionRow?.acceptedPlagiarismScore));

  // Rule 6: immutable once finalised.
  const reupload = await uploadReport(alphaToken, "Alpha Report Rev2");
  check("a finalised report cannot be replaced (rule 6)", reupload.status === 409, `status=${reupload.status} code=${reupload.data.code}`);

  const finalAgain = await fetch(`${BASE}/students/reports/${reportId}/final-submit`, {
    method: "POST",
    headers: alphaAuth2,
  });
  check("cannot finalise twice", finalAgain.status === 409, `status=${finalAgain.status}`);

  const postFinalApprove = await fetch(`${BASE}/reviews/${professionalReviewId}/approve`, { method: "POST", headers: professionalAuth });
  check("reviews are closed once finalised", postFinalApprove.status === 409, `status=${postFinalApprove.status}`);

  // Rules 10 / 12: append-only audit trail.
  const audits = await ReportAudit.findAll({ where: { reportId }, order: [["id", "ASC"]] });
  const actions = audits.map((x) => x.action);
  check("audit trail exists (rule 10)", audits.length >= 5, `rows=${audits.length}`);
  check("audit records the request", actions.includes("submission_requested"), actions.join(","));
  check("audit records both approvals", actions.filter((x) => x === "review_approved").length === 2);
  check("audit records the final submission", actions.includes("final_submitted"));
  check("audit records the lock (rule 12)", actions.includes("report_locked"));

  // ---------- rejection flow ----------
  const b = await buildStudent("beta");
  await Internship.create({
    studentId: b.student.id,
    academicSupervisorId: academic.id,
    professionalSupervisorId: professional.id,
    company: "Globex",
  });
  const betaToken = (await login(b.user.email)).token;
  const betaAuth = auth(betaToken);
  const up2 = await uploadReport(betaToken, "Beta Report");
  const betaReportId = up2.data.report.id;
  ids.reports.push(betaReportId);

  await fetch(`${BASE}/students/reports/${betaReportId}/request-submission`, { method: "POST", headers: betaAuth });
  const betaQueue = await (await fetch(`${BASE}/reviews/pending`, { headers: academicAuth })).json();
  const betaReview = betaQueue.reviews.find((r) => r.report?.id === betaReportId);

  const noReason = await fetch(`${BASE}/reviews/${betaReview.id}/reject`, {
    method: "POST",
    headers: academicAuth,
    body: JSON.stringify({}),
  });
  check("rejection without a reason is refused", noReason.status === 400, `status=${noReason.status}`);

  const rejected = await fetch(`${BASE}/reviews/${betaReview.id}/reject`, {
    method: "POST",
    headers: academicAuth,
    body: JSON.stringify({ reason: "Methodology section is incomplete." }),
  });
  const rejectedData = await rejected.json();
  check("rejection succeeds", rejected.status === 200, `status=${rejected.status}`);
  check("report returns to correction (rule 5)", rejectedData.reportStatus === "rejected_by_academic_supervisor", rejectedData.reportStatus);

  const betaStatus = await (await fetch(`${BASE}/students/reports/${betaReportId}/submission-status`, { headers: betaAuth })).json();
  check("student sees the rejection reason", betaStatus.reviews?.some((r) => r.rejectionReason?.includes("Methodology")));
  check("final submission is not available after rejection", betaStatus.readyForFinalSubmission === false);

  const betaReRequest = await fetch(`${BASE}/students/reports/${betaReportId}/request-submission`, {
    method: "POST",
    headers: betaAuth,
  });
  const betaReRequestData = await betaReRequest.json();
  check("student can request review again after correcting", betaReRequest.status === 201, `status=${betaReRequest.status}`);
  check("the new round has a higher cycle", betaReRequestData.cycle === 2, `cycle=${betaReRequestData.cycle}`);

  // Rule 4: a new file invalidates the in-flight approvals.
  const betaQueue2 = await (await fetch(`${BASE}/reviews/pending`, { headers: academicAuth })).json();
  const betaRound2Review = betaQueue2.reviews.find((r) => r.report?.id === betaReportId);
  const reup2 = await uploadReport(betaToken, "Beta Report Rev2");
  check("student can replace the file while not finalised", reup2.status === 200, `status=${reup2.status}`);
  const staleApprove = await fetch(`${BASE}/reviews/${betaRound2Review.id}/approve`, {
    method: "POST",
    headers: academicAuth,
  });
  const staleData = await staleApprove.json();
  check("a review from a superseded version is refused (rule 4)", staleApprove.status === 409, `status=${staleApprove.status} code=${staleData.code}`);
  check("the refusal is the superseded-version case", ["REVIEW_SUPERSEDED", "REVIEW_STALE_VERSION"].includes(staleData.code), staleData.code);

  // ---------- ownership ----------
  const gamma = await buildStudent("gamma");
  const gammaAuth = auth((await login(gamma.user.email)).token);
  const foreign = await fetch(`${BASE}/students/reports/${betaReportId}/submission-status`, { headers: gammaAuth });
  check("a student cannot read another student's report", foreign.status === 404, `status=${foreign.status}`);

  const foreignReq = await fetch(`${BASE}/students/reports/${betaReportId}/request-submission`, {
    method: "POST",
    headers: gammaAuth,
  });
  check("a student cannot request review on another student's report", foreignReq.status === 404, `status=${foreignReq.status}`);

  const studentOnReviews = await fetch(`${BASE}/reviews/pending`, { headers: gammaAuth });
  check("a student cannot reach the supervisor review queue", studentOnReviews.status === 403, `status=${studentOnReviews.status}`);

  console.log(`\n${failures === 0 ? "ALL WORKFLOW CHECKS PASSED" : `${failures} WORKFLOW CHECK(S) FAILED`}`);
} catch (error) {
  failures++;
  console.error("WORKFLOW VERIFICATION ERROR:", error);
} finally {
  try {
    // Filter first: an aborted run can leave a placeholder undefined in the list,
    // and a WHERE with an undefined value throws.
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
