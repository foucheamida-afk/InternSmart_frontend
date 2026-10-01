import { parentPort } from "node:worker_threads";
import { estimateSimilarity, exactSimilarity, excerptAround } from "../../utils/textFingerprint.js";

/**
 * Dedicated Worker Thread runner for plagiarism similarity calculations.
 *
 * Keeps CPU-heavy MinHash screening and 5-word shingle Set intersections off
 * the main Node.js HTTP event loop so Express endpoints stay 100% responsive.
 */
if (parentPort) {
  parentPort.on("message", (task) => {
    try {
      if (task.type === "SCREEN_CANDIDATES") {
        const { querySignature, candidates, screenFloor, maxCandidates } = task;
        const screened = [];

        for (const candidate of candidates) {
          const estimate = estimateSimilarity(querySignature, candidate.corpusSignature);
          if (estimate >= screenFloor) {
            screened.push({
              reportVersionId: candidate.reportVersionId,
              libraryEntryId: candidate.libraryEntryId,
              entry: candidate.entry,
              estimate,
            });
          }
        }

        screened.sort((a, b) => b.estimate - a.estimate);
        const shortlisted = screened.slice(0, maxCandidates);

        parentPort.postMessage({
          status: "SUCCESS",
          shortlisted,
          screenedCount: screened.length,
        });
      } else if (task.type === "EXACT_MATCHES") {
        const { queryShingles, shortlistedCandidates, queryTokens, firstIndexMapObj, matchFloor } = task;
        const matches = [];
        let topScore = 0;

        for (const candidate of shortlistedCandidates) {
          const { entry, corpusShingles } = candidate;
          const { score, shared, sharedCount } = exactSimilarity(queryShingles, corpusShingles);

          if (score < matchFloor) continue;

          if (score > topScore) topScore = score;

          const firstShared = shared[0];
          const startIndex = firstIndexMapObj?.[firstShared] ?? firstIndexMapObj?.[String(firstShared)];
          const excerpt = excerptAround(queryTokens, startIndex);

          matches.push({
            sourceType: "internal",
            sourceReportId: entry.reportId,
            sourceAcademicYear: entry.academicYear ?? null,
            sourceTitle: entry.title ?? null,
            matchedWords: Math.round(sharedCount * 5),
            similarityPercentage: Math.round(score * 10000) / 100,
            matchedText: excerpt,
          });
        }

        matches.sort((a, b) => (b.similarityPercentage || 0) - (a.similarityPercentage || 0));
        const internalScore = matches.length ? matches[0].similarityPercentage : 0;

        parentPort.postMessage({
          status: "SUCCESS",
          matches,
          internalScore,
        });
      } else {
        parentPort.postMessage({ status: "ERROR", error: `Unknown task type: ${task.type}` });
      }
    } catch (err) {
      parentPort.postMessage({ status: "ERROR", error: err.message || String(err) });
    }
  });
}
