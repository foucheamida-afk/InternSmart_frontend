import crypto from "crypto";
import { Op } from "sequelize";
import Report from "../models/reportModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import PlagiarismAnalysis from "../models/plagiarismAnalysisModel.js";
import {
  requestAnalysis,
  applyWebhookEvent,
  getLatestAnalysis,
  getAnalysisHistory,
  getAnalysisWithMatches,
  listProviders,
  configuredProviders,
  PlagiarismError,
} from "../services/plagiarismService.js";
import { runWorkerTick } from "../jobs/plagiarismWorker.js";
import { bandSummary } from "../utils/similarityThresholds.js";

// Plagiarism API (§4.12 phases 4-5).

const publicAnalysis = (analysis) => ({
  id: analysis.id,
  reportId: analysis.reportId,
  reportVersionId: analysis.reportVersionId,
  provider: analysis.provider,
  analysisType: analysis.analysisType,
  status: analysis.status,
  overallScore: analysis.overallScore,
  internalScore: analysis.internalScore,
  externalScore: analysis.externalScore,
  plagiarismStatus: analysis.plagiarismStatus,
  // The band and the boundaries that produced it travel together, so a number
  // and its label can never disagree on screen if the thresholds are retuned.
  similarityBand: bandSummary(analysis.overallScore),
  // Which sections the exclusion rules discarded, so the effect of the rules is
  // visible rather than silent.
  excludedSections: analysis.excludedSections,
  totalWords: analysis.totalWords,
  matchedWords: analysis.matchedWords,
  errorMessage: analysis.errorMessage,
  requestedAt: analysis.createdAt,
  startedAt: analysis.startedAt,
  completedAt: analysis.completedAt,
});

// Resolve the report a request is about, and prove the caller may touch it.
//
// A student is limited to their own report and a supervisor to students they
// actually supervise. A withheld report answers 404 rather than 403, matching
// the library, so the endpoint cannot be used to probe which report ids exist.
const resolveTarget = async (req) => {
  const report = await Report.findByPk(req.params.reportId);
  if (!report) return { error: { status: 404, message: "Report not found" } };

  const roles = req.effectiveRoles || [req.user.role];

  if (roles.includes("admin")) return { report };

  if (roles.includes("student")) {
    const student = await Student.findOne({ where: { userId: req.user.id }, attributes: ["id"] });
    if (!student || report.studentId !== student.id) {
      return { error: { status: 404, message: "Report not found" } };
    }
    return { report, studentId: student.id };
  }

  const internship = await Internship.findOne({
    where: {
      studentId: report.studentId,
      [Op.or]: [{ academicSupervisorId: req.user.id }, { professionalSupervisorId: req.user.id }],
    },
    attributes: ["id"],
  });

  if (!internship) return { error: { status: 404, message: "Report not found" } };

  return { report };
};

const fail = (res, error, label) => {
  if (error instanceof PlagiarismError) {
    return res.status(error.status).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.details ? { details: error.details } : {}),
    });
  }
  console.error(label, error);
  return res.status(500).json({ message: "Server error", error: error.message });
};

// POST /api/plagiarism/reports/:reportId/analyze
export const requestReportAnalysis = async (req, res) => {
  try {
    const roles = req.effectiveRoles || [req.user?.role];
    if (!roles.includes("academic_supervisor")) {
      return res.status(403).json({
        message: "Only the academic supervisor can analyze a report for plagiarism.",
      });
    }

    const target = await resolveTarget(req);
    if (target.error) return res.status(target.error.status).json({ message: target.error.message });

    const { analysis, reused } = await requestAnalysis({
      report: target.report,
      requestedBy: req.user.id,
      providerName: req.body?.provider || null,
    });

    // Run the plagiarism engine worker tick immediately on button click
    await runWorkerTick().catch((err) => console.error("Plagiarism tick error:", err));

    const updatedTarget = await resolveTarget(req);
    const latestAnalysis = updatedTarget.latestAnalysis || analysis;

    return res.status(200).json({
      message: reused
        ? "An analysis of this version has already been completed."
        : "Plagiarism analysis completed.",
      reused,
      analysis: publicAnalysis(latestAnalysis),
    });
  } catch (error) {
    return fail(res, error, "REQUEST REPORT ANALYSIS ERROR:");
  }
};

// GET /api/plagiarism/reports/:reportId/latest
export const getReportAnalysis = async (req, res) => {
  try {
    const target = await resolveTarget(req);
    if (target.error) return res.status(target.error.status).json({ message: target.error.message });

    const versionId = target.report.currentVersionId;

    const [latest, history] = await Promise.all([
      versionId ? getLatestAnalysis(versionId) : null,
      getAnalysisHistory(target.report.id),
    ]);

    return res.status(200).json({
      reportId: target.report.id,
      reportVersionId: versionId,
      latest: latest
        ? {
            ...publicAnalysis(latest),
            matches: (latest.matches || []).map((match) => ({
              id: match.id,
              sourceType: match.sourceType,
              sourceUrl: match.sourceUrl,
              sourceTitle: match.sourceTitle,
              sourceAcademicYear: match.sourceAcademicYear,
              matchedWords: match.matchedWords,
              similarityPercentage: match.similarityPercentage,
              matchedText: match.matchedText,
            })),
          }
        : null,
      // The history is every analysis for the report, including failed and
      // superseded ones, which is what makes a score auditable.
      history: history.map(publicAnalysis),
    });
  } catch (error) {
    return fail(res, error, "GET REPORT ANALYSIS ERROR:");
  }
};

// GET /api/plagiarism/jobs/:jobId
export const getAnalysisJob = async (req, res) => {
  try {
    const analysis = await getAnalysisWithMatches(req.params.jobId);
    if (!analysis) return res.status(404).json({ message: "Analysis not found" });

    // Reuse the same access rule by resolving the parent report.
    const probe = await resolveTarget({ ...req, params: { reportId: analysis.reportId } });
    if (probe.error) return res.status(probe.error.status).json({ message: probe.error.message });

    return res.status(200).json({ job: publicAnalysis(analysis) });
  } catch (error) {
    return fail(res, error, "GET ANALYSIS JOB ERROR:");
  }
};

// GET /api/plagiarism/providers  (admin)
export const getProviders = async (req, res) => {
  try {
    return res.status(200).json({
      providers: listProviders(),
      configured: configuredProviders(),
    });
  } catch (error) {
    return fail(res, error, "GET PLAGIARISM PROVIDERS ERROR:");
  }
};

// POST /api/plagiarism/webhook/:status  (public)
//
// Copyleaks cannot authenticate, so the endpoint is guarded by a shared secret
// carried in the URL it was given when the scan was submitted.
//
// It FAILS CLOSED when no secret is configured. An unauthenticated endpoint that
// writes plagiarism scores into the archive would let anyone post a fabricated
// "clean" result for a report, which is precisely the integrity property this
// whole module exists to protect.
export const providerWebhook = async (req, res) => {
  try {
    const configuredSecret = process.env.PLAGIARISM_WEBHOOK_SECRET || "";

    if (!configuredSecret) {
      return res.status(503).json({
        message: "The plagiarism webhook is not configured on this server.",
      });
    }

    const provided = String(req.query.secret || req.get("x-plagiarism-secret") || "");

    const expected = Buffer.from(configuredSecret);
    const actual = Buffer.from(provided);
    const matches =
      expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!matches) {
      return res.status(401).json({ message: "Invalid webhook secret." });
    }

    const event = String(req.params.status || "").toLowerCase();
    const result = await applyWebhookEvent({ event, payload: req.body || {} });

    // Always 200 for an authenticated call: Copyleaks retries non-2xx responses,
    // and an unknown scan id is not something a retry can fix. The outcome is in
    // the body and in the server log instead.
    if (!result.handled) {
      console.warn(`PLAGIARISM WEBHOOK IGNORED (event=${event}):`, result.message);
    }

    return res.status(200).json({ received: true, handled: result.handled, status: result.status || null });
  } catch (error) {
    console.error("PLAGIARISM WEBHOOK ERROR:", error);
    // Still 200: a 500 would make Copyleaks retry a payload we cannot process.
    return res.status(200).json({ received: true, handled: false, error: error.message });
  }
};

export { PlagiarismAnalysis };
