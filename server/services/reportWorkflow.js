import path from "path";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import ReportReview from "../models/reportReviewModel.js";
import ReportAudit from "../models/reportAuditModel.js";
import ReportSubmission from "../models/reportSubmissionModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import hashFile from "../utils/fileHash.js";
import { archiveFinalReport } from "./libraryService.js";

// The two-stage report submission workflow:
//
//   student requests submission
//        -> a review round opens, one row per supervisor, both notified
//   each supervisor privately approves or rejects
//        -> both approve  => ready for final submission
//        -> either rejects => back to the student for correction
//   student submits the final version
//        -> approvals re-checked against the exact file, then locked and archived
//
// The rules this enforces (the user's twelve integrity rules) are noted inline,
// because several of them are only satisfied by *where* a check happens rather
// than by the check itself.

export class ReportWorkflowError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = "ReportWorkflowError";
    this.status = status;
    if (code) this.code = code;
  }
}

const absolutePathFor = (fileUrl) => {
  if (!fileUrl) return null;
  return path.join(process.cwd(), "uploads", path.basename(fileUrl));
};

// Which capacity did this person act in for this student?
//
// Derived from the Internship rather than from `User.role`, because one person
// can legitimately be the academic supervisor for one student and the
// professional supervisor for another (see utils/effectiveRoles.js). Reading the
// role column here would attribute the verdict to the wrong capacity for a
// dual-role supervisor.
export const resolveSupervisorType = (internship, userId) => {
  if (!internship) return null;
  if (internship.academicSupervisorId === userId) return "academic";
  if (internship.professionalSupervisorId === userId) return "professional";
  return null;
};

export const logReportAudit = async ({
  reportId,
  reportVersionId = null,
  actorId = null,
  actorRole = null,
  action,
  details = null,
  transaction,
}) => {
  // Rule 10 / 12: append-only. Never throws into the caller - a logging failure
  // must not roll back the business action that already succeeded.
  try {
    await ReportAudit.create(
      { reportId, reportVersionId, actorId, actorRole, action, details },
      { transaction }
    );
  } catch (error) {
    console.warn("REPORT AUDIT ERROR:", error.message);
  }
};

export const getInternshipForStudent = (studentId) =>
  Internship.findOne({ where: { studentId } });

// The current round's verdicts.
//
// `includePrivate` defaults to true for supervisor-scoped callers. The student
// path passes false, which drops the confidential columns from the SELECT itself
// rather than filtering them out afterwards - integrity rule 9 is then satisfied
// by the query, so a future change to a response shape cannot leak a mark.
export const getCurrentReviews = (report, { includePrivate = true } = {}) =>
  ReportReview.findAll({
    where: { reportId: report.id, cycle: report.reviewCycle || 1 },
    ...(includePrivate
      ? {}
      : { attributes: ["id", "supervisorType", "status", "rejectionReason", "reviewedAt", "cycle"] }),
    order: [["supervisorType", "ASC"]],
  });

const isFinal = (report) =>
  Boolean(report?.lockedAt) ||
  report?.status === "final_submitted" ||
  report?.status === "archived";

// What still stands between this report and a submission request.
//
// Returned as a list of reasons rather than a boolean so the client can tell the
// student what to fix instead of showing a dead button.
export const getSubmissionReadiness = (report, internship, reviews) => {
  const issues = [];

  if (!report) {
    issues.push("Upload your report before requesting submission.");
    return { issues, canRequestSubmission: false };
  }

  if (!report.currentVersionId) {
    issues.push("Upload your report before requesting submission.");
  }

  if (!internship) {
    issues.push("You do not have an internship assignment yet.");
  } else {
    if (!internship.academicSupervisorId) {
      issues.push("No academic supervisor is assigned to you yet.");
    }
    if (!internship.professionalSupervisorId) {
      issues.push("No professional supervisor is assigned to you yet.");
    }
  }

  if (isFinal(report)) {
    issues.push("This report has already been finalised.");
  }

  const academic = reviews.find((r) => r.supervisorType === "academic");
  const professional = reviews.find((r) => r.supervisorType === "professional");
  const bothApproved = academic?.status === "approved" && professional?.status === "approved";
  // `cancelled` is deliberately not "pending": a cancelled sibling review must
  // not block the student from requesting a fresh round.
  const anyPending = [academic, professional].some((r) => r?.status === "pending");

  if (anyPending) {
    issues.push("A review is already in progress.");
  }

  if (bothApproved) {
    issues.push("Both supervisors have approved - submit the final report.");
  }

  // A rejection does NOT block a new request: the student corrects the report
  // (which opens a new round) or resubmits for another look.
  return { issues, canRequestSubmission: issues.length === 0 };
};

// Open a fresh review round. Cycle numbers only ever increase, so verdicts from
// an earlier round can never be mistaken for current ones.
export const openReviewRound = async (report, version, { actorId }) => {
  const internship = await getInternshipForStudent(report.studentId);

  if (!internship?.academicSupervisorId || !internship?.professionalSupervisorId) {
    throw new ReportWorkflowError(
      "Both an academic supervisor and a professional supervisor must be assigned before the report can be sent for review."
    );
  }

  if (isFinal(report)) {
    throw new ReportWorkflowError(
      "This report has already been finalised and cannot be sent for review again.",
      409,
      "REPORT_LOCKED"
    );
  }

  const existing = await getCurrentReviews(report);

  if (existing.some((r) => r.status === "pending")) {
    throw new ReportWorkflowError(
      "This report is already awaiting a supervisor's review.",
      409,
      "REVIEW_IN_PROGRESS"
    );
  }

  if (
    existing.some((r) => r.supervisorType === "academic" && r.status === "approved") &&
    existing.some((r) => r.supervisorType === "professional" && r.status === "approved")
  ) {
    throw new ReportWorkflowError(
      "Both supervisors have already approved this report - submit it as final.",
      409,
      "READY_FOR_FINAL_SUBMISSION"
    );
  }

  const highestCycle = (await ReportReview.max("cycle", { where: { reportId: report.id } })) || 0;
  const nextCycle = Number(highestCycle) + 1;
  const requestedAt = new Date();

  const round = [
    {
      reportId: report.id,
      reportVersionId: version.id,
      supervisorId: internship.academicSupervisorId,
      supervisorType: "academic",
      status: "pending",
      cycle: nextCycle,
      requestedAt,
    },
    {
      reportId: report.id,
      reportVersionId: version.id,
      supervisorId: internship.professionalSupervisorId,
      supervisorType: "professional",
      status: "pending",
      cycle: nextCycle,
      requestedAt,
    },
  ];

  await ReportReview.bulkCreate(round);

  await report.update({
    status: "submission_requested",
    reviewCycle: nextCycle,
    submissionRequestedAt: requestedAt,
  });

  for (const entry of round) {
    await Notification.create({
      userId: entry.supervisorId,
      title: "Report sent for review",
      message: `${report.title} is awaiting your review. Both supervisors must approve before the student can submit the final version.`,
      type: "info",
    }).catch((error) => console.warn("REVIEW NOTIFICATION ERROR:", error.message));
  }

  await logReportAudit({
    reportId: report.id,
    reportVersionId: version.id,
    actorId,
    actorRole: "student",
    action: "submission_requested",
    details: {
      cycle: nextCycle,
      academicSupervisorId: internship.academicSupervisorId,
      professionalSupervisorId: internship.professionalSupervisorId,
    },
  });

  return { cycle: nextCycle, reviews: round };
};

// Recompute the report status from the current round's verdicts. Called after
// every approve/reject so the report's own status is never hand-maintained in
// two places.
const syncReportStatusFromReviews = async (report, reviews) => {
  const academic = reviews.find((r) => r.supervisorType === "academic");
  const professional = reviews.find((r) => r.supervisorType === "professional");

  if (academic?.status === "rejected" || professional?.status === "rejected") {
    const status =
      academic?.status === "rejected"
        ? "rejected_by_academic_supervisor"
        : "rejected_by_professional_supervisor";
    await report.update({ status });
    return status;
  }

  const bothApproved = academic?.status === "approved" && professional?.status === "approved";
  const status = bothApproved ? "ready_for_final_submission" : "approved_by_one_supervisor";
  await report.update({ status });
  return status;
};

// Load a review together with the guards every review action needs.
const loadActionableReview = async (reviewId, supervisorId) => {
  const review = await ReportReview.findByPk(reviewId);
  if (!review) throw new ReportWorkflowError("Review not found", 404);

  // Rule 2: a supervisor may only act on a report assigned to them. Enforced on
  // the review row, which is scoped to that supervisor, not merely on the role.
  if (review.supervisorId !== supervisorId) {
    throw new ReportWorkflowError("This review is not assigned to you.", 403);
  }

  const report = await Report.findByPk(review.reportId);
  if (!report) throw new ReportWorkflowError("Report not found", 404);

  // Rule 1: the submitter cannot approve their own report. A student cannot
  // reach this code path - the route is supervisor-only and the review row is
  // bound to a supervisor id - so this is a structural guarantee rather than a
  // runtime comparison.

  if (isFinal(report)) {
    throw new ReportWorkflowError(
      "This report has been finalised; its reviews are closed.",
      409,
      "REPORT_LOCKED"
    );
  }

  // A verdict is only meaningful against the round it belongs to. Once a new
  // file or a new round supersedes it, the review is stale.
  if ((report.reviewCycle || 1) !== review.cycle) {
    throw new ReportWorkflowError(
      "This review has been superseded by a newer round.",
      409,
      "REVIEW_SUPERSEDED"
    );
  }

  if (report.currentVersionId && review.reportVersionId !== report.currentVersionId) {
    throw new ReportWorkflowError(
      "The report file changed after this review was requested. A new review has to be requested.",
      409,
      "REVIEW_STALE_VERSION"
    );
  }

  if (review.status !== "pending") {
    throw new ReportWorkflowError(
      `This review has already been ${review.status}.`,
      409,
      "REVIEW_ALREADY_DECIDED"
    );
  }

  // Loaded here because approval is gated on the supervisor's existing rubric
  // grade for this student (Internship.academicGrade / professionalGrade).
  const internship = await getInternshipForStudent(report.studentId);

  return { review, report, internship };
};

export const approveReview = async ({ reviewId, supervisorId, privateComments = null }) => {
  const { review, report, internship } = await loadActionableReview(reviewId, supervisorId);

  // The product decision this implements: approving a report IS submitting the
  // supervision grade. There is deliberately no separate confidential mark, so
  // an approval without a grade would be a verdict with nothing behind it - and
  // the same supervisor-student pair would end up with two competing marks.
  const isAcademic = review.supervisorType === "academic";
  const grade = isAcademic ? internship?.academicGrade : internship?.professionalGrade;
  const gradeStatus = isAcademic ? internship?.academicGradeStatus : internship?.professionalGradeStatus;
  const gradeSubmittedAt = isAcademic ? internship?.academicGradeSubmittedAt : internship?.professionalGradeSubmittedAt;

  if (!internship || gradeStatus !== "submitted" || grade === null || grade === undefined) {
    throw new ReportWorkflowError(
      `Submit your ${isAcademic ? "academic (out of 20)" : "professional (out of 10)"} supervision grade for this student before approving their report. Approving confirms that grade.`,
      409,
      "RUBRIC_REQUIRED"
    );
  }

  await review.update({
    status: "approved",
    reviewedAt: new Date(),
    // Optional confidential notes. Never returned by a student-facing endpoint.
    privateComments:
      typeof privateComments === "string" && privateComments.trim()
        ? privateComments.trim()
        : review.privateComments,
    // The grade as it stood at approval. A snapshot rather than a live read, so
    // a later re-grade cannot silently rewrite what this supervisor approved.
    gradeSnapshot: {
      scale: isAcademic ? 20 : 10,
      grade,
      gradeSubmittedAt: gradeSubmittedAt || null,
      capturedAt: new Date(),
    },
  });

  const reviews = await getCurrentReviews(report);
  const status = await syncReportStatusFromReviews(report, reviews);

  await logReportAudit({
    reportId: report.id,
    reportVersionId: review.reportVersionId,
    actorId: supervisorId,
    actorRole: review.supervisorType,
    action: "review_approved",
    details: {
      cycle: review.cycle,
      resultingReportStatus: status,
      // The grade the approval was based on, so the audit trail shows what was
      // confirmed rather than only that something was.
      confirmedGrade: grade,
      gradeScale: isAcademic ? 20 : 10,
    },
  });

  await notifyStudentOfVerdict(report, review, "approved", status);

  return { status, reportStatus: status, confirmedGrade: grade };
};

export const rejectReview = async ({ reviewId, supervisorId, reason }) => {
  const trimmed = String(reason || "").trim();
  if (!trimmed) {
    throw new ReportWorkflowError("A reason is required so the student knows what to correct.");
  }

  const { review, report } = await loadActionableReview(reviewId, supervisorId);

  await review.update({
    status: "rejected",
    rejectionReason: trimmed,
    reviewedAt: new Date(),
  });

  // A rejection ends the round for BOTH reviewers. The sibling review is
  // cancelled rather than left pending, so it disappears from the other
  // supervisor's queue - the report has already gone back to the student, so
  // reviewing it would be wasted effort - and so it cannot block the student's
  // next request with "already in progress".
  await ReportReview.update(
    { status: "cancelled", reviewedAt: new Date() },
    {
      where: {
        reportId: review.reportId,
        cycle: review.cycle,
        status: "pending",
      },
    }
  );

  const reviews = await getCurrentReviews(report);
  // Rule 5: a rejection returns the report to correction.
  const status = await syncReportStatusFromReviews(report, reviews);

  await logReportAudit({
    reportId: report.id,
    reportVersionId: review.reportVersionId,
    actorId: supervisorId,
    actorRole: review.supervisorType,
    action: "review_rejected",
    details: { cycle: review.cycle, reason: trimmed, resultingReportStatus: status },
  });

  await notifyStudentOfVerdict(report, review, "rejected", status, trimmed);

  return { status, reportStatus: status };
};

const notifyStudentOfVerdict = async (report, review, verdict, resultingStatus, reason) => {
  try {
    // Notify the student's *user*, resolved through Student rather than assuming
    // an id relationship.
    const studentRow = await Student.findByPk(report.studentId, { attributes: ["userId"] });
    if (!studentRow?.userId) return;

    if (verdict === "approved") {
      const bothApproved = resultingStatus === "ready_for_final_submission";
      await Notification.create({
        userId: studentRow.userId,
        title: bothApproved ? "Both supervisors approved your report" : "A supervisor approved your report",
        message: bothApproved
          ? "You can now submit the final version of your report."
          : "Your report was approved by one supervisor; the other review is still pending.",
        type: "success",
      });
    } else {
      await Notification.create({
        userId: studentRow.userId,
        title: "Report review: correction required",
        message: `Your ${review.supervisorType} supervisor asked for corrections: ${reason}`,
        type: "warning",
      });
    }
  } catch (error) {
    console.warn("VERDICT NOTIFICATION ERROR:", error.message);
  }
};

// Rule 3 + 4 + 6 + 7.
export const finalSubmitReport = async ({ report, student, acceptedPlagiarismScore = null }) => {
  if (!report) throw new ReportWorkflowError("Report not found", 404);

  if (isFinal(report)) {
    throw new ReportWorkflowError(
      "This report has already been submitted as final.",
      409,
      "REPORT_LOCKED"
    );
  }

  const reviews = await getCurrentReviews(report);
  const academic = reviews.find((r) => r.supervisorType === "academic");
  const professional = reviews.find((r) => r.supervisorType === "professional");

  // Rule 3: never with only one approval.
  if (academic?.status !== "approved" || professional?.status !== "approved") {
    const reasons = [];
    if (academic?.status !== "approved") reasons.push(`academic supervisor: ${academic?.status || "no review requested"}`);
    if (professional?.status !== "approved") reasons.push(`professional supervisor: ${professional?.status || "no review requested"}`);
    throw new ReportWorkflowError(
      `Both supervisors must approve before the final submission. Outstanding - ${reasons.join("; ")}.`,
      409,
      "APPROVALS_INCOMPLETE"
    );
  }

  const version = await ReportVersion.findByPk(report.currentVersionId);
  if (!version) {
    throw new ReportWorkflowError("The current report file could not be found.", 409, "VERSION_MISSING");
  }

  // Rule 4: the approvals must describe the bytes being submitted. Comparing the
  // version ids catches the ordinary case (a new upload); re-hashing the stored
  // file catches the file being replaced behind our back.
  for (const review of [academic, professional]) {
    if (review.reportVersionId !== version.id) {
      throw new ReportWorkflowError(
        "The report file changed after it was approved. A new review is required.",
        409,
        "APPROVAL_VERSION_MISMATCH"
      );
    }
  }

  if (version.fileHash) {
    try {
      const actual = await hashFile(absolutePathFor(version.fileUrl));
      if (actual !== version.fileHash) {
        throw new ReportWorkflowError(
          "The stored report file does not match the version that was approved. A new review is required.",
          409,
          "APPROVAL_HASH_MISMATCH"
        );
      }
    } catch (error) {
      if (error instanceof ReportWorkflowError) throw error;
      console.warn("FINAL SUBMIT HASH CHECK ERROR:", error.message);
    }
  }

  const submittedAt = new Date();

  // Rule 7: a permanent hash on every final submission.
  const submission = await ReportSubmission.create({
    reportId: report.id,
    reportVersionId: version.id,
    submittedBy: student.userId,
    fileHash: version.fileHash,
    acceptedPlagiarismScore,
    submittedAt,
  });

  // Rule 6: immutable from here on.
  await report.update({
    status: "final_submitted",
    finalSubmittedAt: submittedAt,
    lockedAt: submittedAt,
  });

  await logReportAudit({
    reportId: report.id,
    reportVersionId: version.id,
    actorId: student.userId,
    actorRole: "student",
    action: "final_submitted",
    details: {
      cycle: report.reviewCycle,
      fileHash: version.fileHash,
      acceptedPlagiarismScore,
      submissionId: submission.id,
    },
  });

  await logReportAudit({
    reportId: report.id,
    reportVersionId: version.id,
    actorId: student.userId,
    actorRole: "system",
    action: "report_locked",
    details: { lockedAt: submittedAt },
  });

  // Phase 3: the archived version enters the virtual library.
  //
  // Failure here must not fail the submission - the ReportSubmission row is the
  // authoritative record of what was accepted, and `archiveFinalReport` is
  // idempotent on the version id, so a missing entry can be re-derived. It is
  // recorded in the audit trail either way rather than passing silently.
  let libraryEntry = null;
  try {
    const archived = await archiveFinalReport({ report, version, student, submission });
    libraryEntry = archived.entry;

    await logReportAudit({
      reportId: report.id,
      reportVersionId: version.id,
      actorId: student.userId,
      actorRole: "system",
      action: "archived_to_library",
      details: {
        libraryEntryId: archived.entry.id,
        created: archived.created,
        academicYear: archived.entry.academicYear,
        visibility: archived.entry.visibility,
      },
    });
  } catch (archiveError) {
    console.warn("LIBRARY ARCHIVE ERROR:", archiveError.message);
    await logReportAudit({
      reportId: report.id,
      reportVersionId: version.id,
      actorId: student.userId,
      actorRole: "system",
      action: "library_archive_failed",
      details: { message: archiveError.message },
    });
  }

  await notifyAfterFinalSubmission(report, version);

  return { submission, version, submittedAt, libraryEntry };
};

const notifyAfterFinalSubmission = async (report, version) => {
  try {
    const internship = await Internship.findOne({ where: { studentId: report.studentId } });
    const recipients = [internship?.academicSupervisorId, internship?.professionalSupervisorId].filter(Boolean);

    for (const userId of recipients) {
      await Notification.create({
        userId,
        title: "Final report submitted",
        message: `${report.title} has been submitted as final and archived.`,
        type: "success",
      });
    }

    const admins = await User.findAll({ where: { role: "admin" }, attributes: ["id"] });
    for (const admin of admins) {
      await Notification.create({
        userId: admin.id,
        title: "Report archived",
        message: `${report.title} was submitted as final (version ${version.versionNumber}).`,
        type: "info",
      });
    }
  } catch (error) {
    console.warn("FINAL SUBMISSION NOTIFICATION ERROR:", error.message);
  }
};

export default {
  openReviewRound,
  approveReview,
  rejectReview,
  finalSubmitReport,
  getSubmissionReadiness,
  getCurrentReviews,
  resolveSupervisorType,
  logReportAudit,
  ReportWorkflowError,
};
