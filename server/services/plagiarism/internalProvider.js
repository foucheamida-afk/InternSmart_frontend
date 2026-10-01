import { Op } from "sequelize";
import LibraryEntry from "../../models/libraryEntryModel.js";
import Report from "../../models/reportModel.js";
import ReportVersion from "../../models/reportVersionModel.js";
import ReportPlagiarismIndex from "../../models/reportPlagiarismIndexModel.js";
import extractPdfText from "../../utils/extractPdfText.js";
import { absolutePathFor } from "../../utils/uploadPath.js";
import {
  ALGORITHM_VERSION,
  fingerprintText,
  plainTextFromDocumentTree,
  tokenize,
} from "../../utils/textFingerprint.js";
import { stripExcludedSections } from "../../utils/textExclusions.js";
import { classifySimilarity } from "../../utils/similarityThresholds.js";
import { runPlagiarismWorkerTask } from "./workerRunner.js";

// Internal similarity engine: compare a report against the virtual library.
//
// Offloaded to Node.js Worker Threads (`workerRunner.js`) to keep heavy MinHash
// screening and 5-word shingle comparisons off the main Express event loop.
//
// Uses projection and batch queries to avoid loading `corpusShingles` (up to 205KB)
// for candidates that fail the initial MinHash signature screening pass.

const SCREEN_FLOOR = Number(process.env.PLAGIARISM_INTERNAL_SCREEN_FLOOR) || 0.06;
const MAX_CANDIDATES = Number(process.env.PLAGIARISM_INTERNAL_MAX_CANDIDATES) || 25;
const MATCH_FLOOR = Number(process.env.PLAGIARISM_INTERNAL_MATCH_FLOOR) || 0.03;

const isConfigured = () => true;

const describe = () => ({
  provider: "internal",
  configured: true,
  asynchronous: false,
  notes:
    "Compares a report against archived reports in the virtual library using 5-word shingles and MinHash signature screening in a background worker thread.",
});

// Plain text for a report version.
const textForVersion = async (version) => {
  if (!version) return "";

  const report = await Report.findByPk(version.reportId, {
    attributes: ["id", "documentContent"],
  });
  const fromTree = plainTextFromDocumentTree(report?.documentContent);
  if (fromTree) {
    return fromTree;
  }

  try {
    const tree = await extractPdfText(absolutePathFor(version.fileUrl));
    const fromFile = plainTextFromDocumentTree(tree);
    if (fromFile) {
      return fromFile;
    }
  } catch (err) {
    console.warn(`textForVersion: text extraction error for version ${version.id}:`, err.message);
  }

  return "";
};

// Fingerprint a library entry that has not been indexed yet.
const ensureIndexed = async (entry) => {
  let index = await ReportPlagiarismIndex.findOne({
    where: { reportVersionId: entry.reportVersionId },
    attributes: ["id", "reportVersionId", "libraryEntryId", "corpusSignature", "corpusWordCount", "algorithmVersion"],
  }).catch(async () => {
    await ReportPlagiarismIndex.sync();
    return ReportPlagiarismIndex.findOne({
      where: { reportVersionId: entry.reportVersionId },
      attributes: ["id", "reportVersionId", "libraryEntryId", "corpusSignature", "corpusWordCount", "algorithmVersion"],
    });
  });

  if (index && index.corpusSignature && index.algorithmVersion === ALGORITHM_VERSION) {
    return index;
  }

  const version = await ReportVersion.findByPk(entry.reportVersionId);
  const text = await textForVersion(version);
  const fingerprint = fingerprintText(stripExcludedSections(text).text);

  if (!fingerprint.comparable) {
    if (index) {
      await index.update({
        libraryEntryId: entry.id,
        corpusWordCount: fingerprint.wordCount,
        algorithmVersion: ALGORITHM_VERSION,
        indexedAt: new Date(),
      });
    } else {
      index = await ReportPlagiarismIndex.create({
        reportVersionId: entry.reportVersionId,
        libraryEntryId: entry.id,
        corpusWordCount: fingerprint.wordCount,
        algorithmVersion: ALGORITHM_VERSION,
        indexedAt: new Date(),
      });
    }
    return index;
  }

  if (index) {
    await index.update({
      libraryEntryId: entry.id,
      corpusSignature: fingerprint.signature,
      corpusShingles: fingerprint.shingles,
      corpusWordCount: fingerprint.wordCount,
      algorithmVersion: ALGORITHM_VERSION,
      indexedAt: new Date(),
    });
  } else {
    index = await ReportPlagiarismIndex.create({
      reportVersionId: entry.reportVersionId,
      libraryEntryId: entry.id,
      corpusSignature: fingerprint.signature,
      corpusShingles: fingerprint.shingles,
      corpusWordCount: fingerprint.wordCount,
      algorithmVersion: ALGORITHM_VERSION,
      indexedAt: new Date(),
    });
  }

  return index;
};

// Submit = run the comparison via batch queries and Worker Thread offloading.
const submit = async ({ analysis, version }) => {
  const text = await textForVersion(version);

  if (!text) {
    throw new Error(
      "No text could be extracted from this report, so it cannot be compared against the library."
    );
  }

  const exclusions = stripExcludedSections(text);
  const query = fingerprintText(exclusions.text);

  if (!query.comparable) {
    throw new Error(
      `The report is too short to compare (${query.wordCount} usable words after exclusions; at least 5 are needed).`
    );
  }

  // Step 1: Batch fetch candidate metadata
  const candidates = await LibraryEntry.findAll({
    where: { reportVersionId: { [Op.ne]: version.id } },
    attributes: ["id", "reportId", "reportVersionId", "academicYear", "title", "submissionDate"],
    order: [["submissionDate", "DESC"]],
  });

  if (!candidates.length) {
    return {
      externalScanId: null,
      completed: {
        status: "completed",
        internalScore: 0,
        plagiarismStatus: classifySimilarity(0),
        excludedSections: exclusions.removedSections,
        totalWords: query.wordCount,
        matchedWords: 0,
        rawSummary: {
          algorithmVersion: ALGORITHM_VERSION,
          corpusSize: 0,
          screened: 0,
          shortlisted: 0,
          reportedMatches: 0,
          excludedSections: exclusions.removedSections,
          excludedCharacters: exclusions.removedCharacters,
        },
        matches: [],
        message: "Compared against 0 archived report(s); no overlap above 3%.",
      },
    };
  }

  // Step 2: Batch fetch candidate indices WITHOUT corpusShingles (eliminates N+1 queries)
  const candidateVersionIds = candidates.map((c) => c.reportVersionId);
  const existingIndexes = await ReportPlagiarismIndex.findAll({
    where: { reportVersionId: candidateVersionIds },
    attributes: ["id", "reportVersionId", "libraryEntryId", "corpusSignature", "algorithmVersion"],
  });

  const indexByVersionId = new Map(existingIndexes.map((idx) => [idx.reportVersionId, idx]));

  const candidatePayloads = [];
  for (const entry of candidates) {
    let idx = indexByVersionId.get(entry.reportVersionId);
    if (!idx || !idx.corpusSignature || idx.algorithmVersion !== ALGORITHM_VERSION) {
      idx = await ensureIndexed(entry);
    }
    if (idx && idx.corpusSignature) {
      candidatePayloads.push({
        reportVersionId: entry.reportVersionId,
        libraryEntryId: entry.id,
        entry: {
          id: entry.id,
          reportId: entry.reportId,
          academicYear: entry.academicYear ?? null,
          title: entry.title ?? null,
        },
        corpusSignature: idx.corpusSignature,
      });
    }
  }

  // Step 3: Run candidate screening off the main thread in a Worker Thread
  const screenResult = await runPlagiarismWorkerTask({
    type: "SCREEN_CANDIDATES",
    querySignature: query.signature,
    candidates: candidatePayloads,
    screenFloor: SCREEN_FLOOR,
    maxCandidates: MAX_CANDIDATES,
  });

  const shortlisted = screenResult.shortlisted || [];

  if (!shortlisted.length) {
    return {
      externalScanId: null,
      completed: {
        status: "completed",
        internalScore: 0,
        plagiarismStatus: classifySimilarity(0),
        excludedSections: exclusions.removedSections,
        totalWords: query.wordCount,
        matchedWords: 0,
        rawSummary: {
          algorithmVersion: ALGORITHM_VERSION,
          corpusSize: candidates.length,
          screened: screenResult.screenedCount || 0,
          shortlisted: 0,
          reportedMatches: 0,
          excludedSections: exclusions.removedSections,
          excludedCharacters: exclusions.removedCharacters,
        },
        matches: [],
        message: `Compared against ${candidates.length} archived report(s); no overlap above ${Math.round(MATCH_FLOOR * 100)}%.`,
      },
    };
  }

  // Step 4: Batch fetch corpusShingles ONLY for shortlisted candidates
  const shortlistVersionIds = shortlisted.map((c) => c.reportVersionId);
  const shingleRows = await ReportPlagiarismIndex.findAll({
    where: { reportVersionId: shortlistVersionIds },
    attributes: ["reportVersionId", "corpusShingles"],
  });

  const shinglesByVersionId = new Map(shingleRows.map((row) => [row.reportVersionId, row.corpusShingles]));

  const shortlistedWithShingles = shortlisted
    .map((item) => ({
      ...item,
      corpusShingles: shinglesByVersionId.get(item.reportVersionId) || [],
    }))
    .filter((item) => Array.isArray(item.corpusShingles) && item.corpusShingles.length > 0);

  // Convert firstIndexByHash Map to plain object for worker postMessage
  const firstIndexMapObj = {};
  if (query.firstIndexByHash) {
    for (const [hash, idx] of query.firstIndexByHash.entries()) {
      firstIndexMapObj[hash] = idx;
    }
  }

  // Step 5: Run exact shingle comparisons off the main thread in a Worker Thread
  const matchResult = await runPlagiarismWorkerTask({
    type: "EXACT_MATCHES",
    queryShingles: query.shingles,
    shortlistedCandidates: shortlistedWithShingles,
    queryTokens: tokenize(exclusions.text),
    firstIndexMapObj,
    matchFloor: MATCH_FLOOR,
  });

  const matches = matchResult.matches || [];
  const internalScore = matchResult.internalScore || 0;

  return {
    externalScanId: null,
    completed: {
      status: "completed",
      internalScore,
      plagiarismStatus: classifySimilarity(internalScore),
      excludedSections: exclusions.removedSections,
      totalWords: query.wordCount,
      matchedWords: matches.reduce((sum, match) => sum + (match.matchedWords || 0), 0),
      rawSummary: {
        algorithmVersion: ALGORITHM_VERSION,
        corpusSize: candidates.length,
        screened: screenResult.screenedCount || 0,
        shortlisted: shortlisted.length,
        reportedMatches: matches.length,
        excludedSections: exclusions.removedSections,
        excludedCharacters: exclusions.removedCharacters,
      },
      matches,
      message: matches.length
        ? `Compared against ${candidates.length} archived report(s); the highest overlap is ${internalScore}%.`
        : `Compared against ${candidates.length} archived report(s); no overlap above ${Math.round(MATCH_FLOOR * 100)}%.`,
    },
  };
};

const handleStatusWebhook = async () => ({
  status: null,
  message: "The internal engine is synchronous and emits no webhooks.",
});

export { ALGORITHM_VERSION, ensureIndexed, textForVersion };

export default {
  name: "internal",
  isConfigured,
  describe,
  submit,
  handleStatusWebhook,
};
