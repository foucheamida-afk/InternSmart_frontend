import ReportReview from "../models/reportReviewModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import {
  approveReview as approveReviewWorkflow,
  rejectReview as rejectReviewWorkflow,
  ReportWorkflowError,
} from "../services/reportWorkflow.js";

// Supervisor-facing review queue.
//
// Both supervisor types share this surface, because the review row - not the
// account's role - determines which capacity the reviewer acts in. A person who
// is the academic supervisor for one student and the professional supervisor for
// another uses the same endpoints for both, and the verdict is attributed by
// `supervisorType` on the row.

const reportInclude = {
  model: Report,
  as: "report",
  include: [
    {
      model: Student,
      as: "student",
      include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }],
    },
  ],
};

const reviewShape = (review, version) => ({
  id: review.id,
  supervisorType: review.supervisorType,
  status: review.status,
  cycle: review.cycle,
  requestedAt: review.requestedAt,
  reviewedAt: review.reviewedAt,
  rejectionReason: review.rejectionReason,
  // The reviewer's own confidential notes, and the grade their approval was
  // based on. Only ever returned on supervisor-scoped endpoints; never on the
  // student's.
  privateComments: review.privateComments,
  gradeSnapshot: review.gradeSnapshot,
  report: review.report
    ? {
        id: review.report.id,
        title: review.report.title,
        status: review.report.status,
        reviewCycle: review.report.reviewCycle,
        student: review.report.student
          ? {
              id: review.report.student.id,
              name: review.report.student.user?.name,
              email: review.report.student.user?.email,
              matricule: review.report.student.matricule,
              class: review.report.student.class,
            }
          : null,
      }
    : null,
  version: version
    ? {
        id: version.id,
        versionNumber: version.versionNumber,
        fileName: version.fileName,
        fileUrl: version.fileUrl,
        pageCount: version.pageCount,
      }
    : null,
});

// GET /api/reviews/pending
export const getPendingReviews = async (req, res) => {
  try {
    const reviews = await ReportReview.findAll({
      where: { supervisorId: req.user.id, status: "pending" },
      include: [reportInclude],
      order: [["requestedAt", "ASC"]],
    });

    // A pending row from a superseded cycle is not actionable: the student has
    // since uploaded a new file or opened a newer round. Filtering here rather
    // than in SQL because it compares a row against its parent's column.
    const actionable = reviews.filter(
      (review) => review.report && review.cycle === (review.report.reviewCycle || 1)
    );

    const versionIds = actionable.map((r) => r.reportVersionId);
    const versions = versionIds.length
      ? await ReportVersion.findAll({ where: { id: versionIds } })
      : [];
    const versionById = new Map(versions.map((v) => [v.id, v]));

    return res.status(200).json({
      reviews: actionable.map((review) => reviewShape(review, versionById.get(review.reportVersionId))),
      total: actionable.length,
    });
  } catch (error) {
    console.error("GET PENDING REVIEWS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching your review queue",
      error: error.message,
    });
  }
};

// GET /api/reviews/:id
export const getReviewDetail = async (req, res) => {
  try {
    const review = await ReportReview.findOne({
      where: { id: req.params.id, supervisorId: req.user.id },
      include: [reportInclude],
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const version = review.reportVersionId
      ? await ReportVersion.findByPk(review.reportVersionId)
      : null;

    return res.status(200).json({ review: reviewShape(review, version) });
  } catch (error) {
    console.error("GET REVIEW DETAIL ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching the review",
      error: error.message,
    });
  }
};

const handleWorkflowError = (res, error, logLabel) => {
  if (error instanceof ReportWorkflowError) {
    return res.status(error.status).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  }
  console.error(logLabel, error);
  return res.status(500).json({ message: "Server error", error: error.message });
};

// POST /api/reviews/:id/approve
//
// Approving a report means submitting the supervision grade, so this refuses
// with RUBRIC_REQUIRED until the caller has submitted their existing rubric
// grade for the student (academic /20 or professional /10).
export const approveReview = async (req, res) => {
  try {
    const result = await approveReviewWorkflow({
      reviewId: req.params.id,
      supervisorId: req.user.id,
      // Optional confidential notes. Never returned by a student-facing endpoint.
      privateComments: req.body?.privateComments ?? null,
    });

    return res.status(200).json({
      message:
        result.reportStatus === "ready_for_final_submission"
          ? `Approved, confirming your grade of ${result.confirmedGrade}. Both supervisors have now approved, so the student can submit the final report.`
          : `Approved, confirming your grade of ${result.confirmedGrade}. Waiting for the other supervisor's review.`,
      reviewStatus: "approved",
      reportStatus: result.reportStatus,
      confirmedGrade: result.confirmedGrade,
    });
  } catch (error) {
    return handleWorkflowError(res, error, "APPROVE REVIEW ERROR:");
  }
};

// POST /api/reviews/:id/reject
export const rejectReview = async (req, res) => {
  try {
    const result = await rejectReviewWorkflow({
      reviewId: req.params.id,
      supervisorId: req.user.id,
      reason: req.body?.reason ?? req.body?.rejectionReason,
    });

    return res.status(200).json({
      message: "Rejected. The student has been asked to correct the report.",
      reviewStatus: "rejected",
      reportStatus: result.reportStatus,
    });
  } catch (error) {
    return handleWorkflowError(res, error, "REJECT REVIEW ERROR:");
  }
};
