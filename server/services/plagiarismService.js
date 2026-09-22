import { Op } from "sequelize";
import PlagiarismAnalysis from "../models/plagiarismAnalysisModel.js";
import PlagiarismMatch from "../models/plagiarismMatchModel.js";
import LibraryEntry from "../models/libraryEntryModel.js";
import Report from "../models/reportModel.js";
import ReportVersion from "../models/reportVersionModel.js";
import { absolutePathFor } from "../utils/uploadPath.js";
import { resolveProvider, getProvider, listProviders, configuredProviders } from "./plagiarism/index.js";

// Orchestrates a plagiarism analysis: queue -> submit -> webhook -> results.
//
// The 0-byte file that previously sat at this path was the "intended modular
// seam" named by the SRS; this is that seam filled in.
//
// Runs through a database-backed queue rather than inline. Copyleaks is
// asynchronous by design - it takes minutes and answers by webhook - and the
// module specification is explicit that the student must not be left waiting
// inside an HTTP request. A table plus a polling worker keeps that asynchronous
// without adding Redis or a broker to a university deployment.

export class PlagiarismError extends Error {
  constructor(message, status = 400, code = null, details = null) {
    super(message);
    this.name = "PlagiarismError";
    this.status = status;
    if (code) this.code = code;
    if (details) this.details = details;
  }
}

const MAX_ATTEMPTS = Number(process.env.PLAGIARISM_MAX_ATTEMPTS) || 3;

export { listProviders, configuredProviders };

// Queue an analysis of the report's current version.
export const requestAnalysis = async ({ report, requestedBy = null, providerName = null }) => {
  const version = report.currentVersionId
    ? await ReportVersion.findByPk(report.currentVersionId)
    : null;

  if (!version) {
    throw new PlagiarismError(
      "Upload the report before requesting a plagiarism analysis.",
      400,
      "NO_VERSION"
    );
  }

  const resolved = resolveProvider(providerName);
  if (resolved.error) {
    throw new PlagiarismError(resolved.error, 503, "NO_PROVIDER", { missing: resolved.missing || [] });
  }

  const provider = resolved.provider;

  // Reuse an in-flight analysis of the same version rather than queueing a
  // duplicate scan, which would consume a second credit for the same answer.
  const inFlight = await PlagiarismAnalysis.findOne({
    where: {
      reportVersionId: version.id,
      provider: provider.name,
      status: { [Op.in]: ["queued", "submitted", "processing"] },
    },
    order: [["id", "DESC"]],
  });

  if (inFlight) return { analysis: inFlight, reused: true };

  const libraryEntry = await LibraryEntry.findOne({ where: { reportVersionId: version.id } });

  const analysis = await PlagiarismAnalysis.create({
    reportId: report.id,
    reportVersionId: version.id,
    libraryEntryId: libraryEntry?.id ?? null,
    provider: provider.name,
    analysisType: provider.name === "copyleaks" ? "external" : "internal",
    status: "queued",
    requestedBy,
  });

  return { analysis, reused: false };
};

// One worker tick: submit every queued analysis that has not exhausted its
// attempts.
//
// Submission failures are recorded on the row and retried up to MAX_ATTEMPTS;
// after that the row is failed with the reason, which is what a supervisor needs
// to see rather than an analysis that silently never completes.
export const processQueuedAnalyses = async ({ limit = 5 } = {}) => {
  const queued = await PlagiarismAnalysis.findAll({
    where: { status: "queued", attemptCount: { [Op.lt]: MAX_ATTEMPTS } },
    order: [["id", "ASC"]],
    limit,
  });

  const results = [];

  for (const analysis of queued) {
    const provider = getProvider(analysis.provider);
    const attempts = analysis.attemptCount + 1;

    if (!provider || !provider.isConfigured()) {
      await analysis.update({
        status: "failed",
        attemptCount: attempts,
        errorMessage: `Provider "${analysis.provider}" is not configured on this server.`,
        completedAt: new Date(),
      });
      results.push({ id: analysis.id, outcome: "unconfigured" });
      continue;
    }

    await analysis.update({
      status: "submitted",
      attemptCount: attempts,
      startedAt: analysis.startedAt || new Date(),
    });

    try {
      const version = await ReportVersion.findByPk(analysis.reportVersionId);
      const submission = await provider.submit({
        analysis,
        version,
        absoluteFilePath: absolutePathFor(version?.fileUrl),
      });

      if (submission?.completed) {
        // A synchronous provider (the internal engine) has already finished, so
        // there is nothing to wait for and no webhook will arrive. Applying the
        // outcome through the same path the webhook uses keeps one definition of
        // "completed" rather than two.
        await applyOutcome(analysis, submission.completed);
        results.push({ id: analysis.id, outcome: "completed-synchronously" });
        continue;
      }

      await analysis.update({
        status: "processing",
        externalScanId: submission?.externalScanId ?? analysis.externalScanId ?? null,
      });

      results.push({ id: analysis.id, outcome: "submitted", externalScanId: submission?.externalScanId ?? null });
    } catch (error) {
      const exhausted = attempts >= MAX_ATTEMPTS;
      await analysis.update({
        status: exhausted ? "failed" : "queued",
        errorMessage: error.message,
        completedAt: exhausted ? new Date() : null,
      });
      console.warn(`PLAGIARISM SUBMIT FAILED (analysis ${analysis.id}):`, error.message);
      results.push({ id: analysis.id, outcome: "error", message: error.message });
    }
  }

  return results;
};

// Apply an inbound provider webhook.
//
// The row is located by the scan id Copyleaks echoes back, because the webhook
// carries no authentication and nothing else identifying. An unknown scan id is
// acknowledged rather than treated as an error: the endpoint is public, so
// probing it must not be able to distinguish "unknown scan" from "handled".
export const applyWebhookEvent = async ({ event, payload }) => {
  const scanId = payload?.scanId ?? payload?.externalScanId;

  if (!scanId) return { handled: false, message: "No scan id in the payload." };

  const analysis = await PlagiarismAnalysis.findOne({ where: { externalScanId: scanId } });
  if (!analysis) return { handled: false, message: "Unknown scan id." };

  const provider = getProvider(analysis.provider);
  if (!provider) {
    return { handled: false, message: `No provider registered for "${analysis.provider}".` };
  }

  const outcome = await provider.handleStatusWebhook({ analysis, event, payload });

  if (!outcome?.status) {
    return { handled: false, message: outcome?.message || "Unhandled event." };
  }

  const applied = await applyOutcome(analysis, outcome);
  return { handled: true, analysis, ...applied };
};

// Apply a provider outcome to its analysis row.
//
// Shared by the webhook path (asynchronous providers) and the worker's direct
// path (synchronous ones), so "what counts as completed" has exactly one
// definition and the two cannot drift.
const applyOutcome = async (analysis, outcome) => {
  if (outcome.status === "failed") {
    await analysis.update({
      status: "failed",
      errorMessage: outcome.message || "The provider reported an error.",
      completedAt: new Date(),
    });
    return { status: "failed" };
  }

  if (outcome.status === "processing") {
    await analysis.update({ status: "processing" });
    return { status: "processing" };
  }

  const externalScore = typeof outcome.externalScore === "number" ? outcome.externalScore : null;
  const internalScore = typeof outcome.internalScore === "number" ? outcome.internalScore : null;

  // Whichever provider ran supplies the headline number. The two are kept in
  // separate columns because they answer different questions - "copied from the
  // web" and "copied from a previous student" - and blending them at rest would
  // make that distinction unrecoverable.
  const overallScore = externalScore ?? internalScore;

  await analysis.update({
    status: "completed",
    externalScore,
    internalScore,
    overallScore,
    plagiarismStatus: outcome.plagiarismStatus ?? null,
    excludedSections: outcome.excludedSections ?? null,
    totalWords: outcome.totalWords ?? null,
    matchedWords: outcome.matchedWords ?? null,
    rawSummary: outcome.rawSummary ?? null,
    completedAt: new Date(),
    errorMessage: null,
  });

  await persistMatches(analysis, outcome.matches || []);
  await pushScoreToLibrary(analysis, overallScore, outcome.plagiarismStatus ?? null);

  return { status: "completed", score: overallScore };
};

const persistMatches = async (analysis, matches) => {
  // Replace rather than append: a re-delivered webhook for the same scan must
  // not double the match list.
  await PlagiarismMatch.destroy({ where: { analysisId: analysis.id } });
  if (!matches.length) return 0;
  await PlagiarismMatch.bulkCreate(matches.map((match) => ({ ...match, analysisId: analysis.id })));
  return matches.length;
};

// Integrity rule 8: the score belongs to the exact version it was computed from.
//
// The lookup is guarded on the version id, so a late webhook for a superseded
// version cannot overwrite the score of the version now in the library.
const pushScoreToLibrary = async (analysis, score, plagiarismStatus = null) => {
  if (score === null) return false;

  const entry = await LibraryEntry.findOne({ where: { reportVersionId: analysis.reportVersionId } });
  if (!entry) return false;

  // The band is stored alongside the number it was derived from. It is a label
  // for prioritising review, not a finding: a similarity score is not proof of
  // misconduct, since references, quotations and standard definitions all match.
  await entry.update({
    finalPlagiarismScore: score,
    plagiarismStatus,
    externalSimilarityScore: analysis.provider === "copyleaks" ? score : entry.externalSimilarityScore,
    internalSimilarityScore: analysis.provider === "internal" ? score : entry.internalSimilarityScore,
  });

  return true;
};

export const getLatestAnalysis = (reportVersionId) =>
  PlagiarismAnalysis.findOne({
    where: { reportVersionId, status: "completed" },
    order: [["completedAt", "DESC"], ["id", "DESC"]],
    include: [{ model: PlagiarismMatch, as: "matches" }],
  });

export const getAnalysisHistory = (reportId) =>
  PlagiarismAnalysis.findAll({ where: { reportId }, order: [["id", "DESC"]], limit: 50 });

export const getAnalysisWithMatches = (analysisId) =>
  PlagiarismAnalysis.findByPk(analysisId, {
    include: [{ model: PlagiarismMatch, as: "matches" }],
  });

export const getReportForAnalysis = (reportId, studentId = null) => {
  const where = { id: reportId };
  if (studentId !== null) where.studentId = studentId;
  return Report.findOne({ where });
};

export default {
  requestAnalysis,
  processQueuedAnalyses,
  applyWebhookEvent,
  getLatestAnalysis,
  getAnalysisHistory,
  getAnalysisWithMatches,
  getReportForAnalysis,
  listProviders,
  configuredProviders,
  PlagiarismError,
};
