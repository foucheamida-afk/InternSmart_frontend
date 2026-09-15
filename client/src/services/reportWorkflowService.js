import { getStoredToken } from "../utils/storage";
import { API_BASE, API_ORIGIN } from "./apiBase";

// The origin lives in apiBase.js so the library service and this one cannot
// disagree about where the API is.
export { API_BASE, API_ORIGIN };

// Thin wrappers over the two-stage submission endpoints (§4.12).
//
// Kept separate from the page components so the student panel and the supervisor
// review queue share one definition of each call, and so the error `code` the
// API returns (APPROVALS_INCOMPLETE, REPORT_LOCKED, REVIEW_SUPERSEDED, ...) is
// preserved rather than flattened into a bare message - the UI needs it to tell
// "you cannot do this yet" apart from "this went wrong".

const request = async (path, { method = "GET", body } = {}) => {
  const token = getStoredToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.message || "Something went wrong. Please try again.");
    error.status = response.status;
    error.code = data?.code || null;
    error.data = data;
    throw error;
  }

  return data;
};

// --- student ---------------------------------------------------------------
export const getSubmissionStatus = (reportId) =>
  request(`/students/reports/${reportId}/submission-status`);

export const requestReportSubmission = (reportId) =>
  request(`/students/reports/${reportId}/request-submission`, { method: "POST" });

export const submitFinalReport = (reportId, acceptedPlagiarismScore = null) =>
  request(`/students/reports/${reportId}/final-submit`, {
    method: "POST",
    body: { acceptedPlagiarismScore },
  });

// --- supervisors -----------------------------------------------------------
export const getMyReviewQueue = () => request("/reviews/pending");

export const getReview = (reviewId) => request(`/reviews/${reviewId}`);

// Approving a report also confirms the supervisor's existing rubric grade, so
// this can fail with RUBRIC_REQUIRED until that grade is submitted. Optional
// confidential notes are stored on the review and never returned to a student.
export const approveReview = (reviewId, privateComments = null) =>
  request(`/reviews/${reviewId}/approve`, {
    method: "POST",
    body: { privateComments },
  });

export const rejectReview = (reviewId, reason) =>
  request(`/reviews/${reviewId}/reject`, { method: "POST", body: { reason } });

export default {
  getSubmissionStatus,
  requestReportSubmission,
  submitFinalReport,
  getMyReviewQueue,
  getReview,
  approveReview,
  rejectReview,
};
