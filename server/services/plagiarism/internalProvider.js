import { Op } from "sequelize";
import LibraryEntry from "../../models/libraryEntryModel.js";
import Report from "../../models/reportModel.js";
import ReportVersion from "../../models/reportVersionModel.js";
import extractPdfText from "../../utils/extractPdfText.js";
import { absolutePathFor } from "../../utils/uploadPath.js";
import {
  ALGORITHM_VERSION,
  estimateSimilarity,
  exactSimilarity,
  excerptAround,
  fingerprintText,
  plainTextFromDocumentTree,
  tokenize,
} from "../../utils/textFingerprint.js";
import { stripExcludedSections } from "../../utils/textExclusions.js";
import { classifySimilarity } from "../../utils/similarityThresholds.js";

// Internal similarity engine: compare a report against the virtual library.
//
// This is the half of the module that addresses the actual problem - students
// reusing reports from earlier cohorts. The external provider finds material
// copied from the web; only the internal engine can find a report copied from a
// previous student at the same institution.
//
// Synchronous, unlike Copyleaks: there is no network call and the corpus is a
// local table, so the analysis completes inside the worker tick and needs no
// webhook. The provider contract allows that by returning a completed outcome
// from `submit`.

// Shingle sets of a few hundred reports are cheap to compare, so screening is
// generous and the exact pass decides.
const SCREEN_FLOOR = Number(process.env.PLAGIARISM_INTERNAL_SCREEN_FLOOR) || 0.06;

// How many screened candidates get the expensive exact comparison.
const MAX_CANDIDATES = Number(process.env.PLAGIARISM_INTERNAL_MAX_CANDIDATES) || 25;

// A pair below this contributes no match row: on a corpus of student reports,
// boilerplate covers, contents pages and standard methodology headings produce
// small overlaps in almost every pair.
const MATCH_FLOOR = Number(process.env.PLAGIARISM_INTERNAL_MATCH_FLOOR) || 0.03;

// The engine is always available: it needs no credentials and no network.
const isConfigured = () => true;

const describe = () => ({
  provider: "internal",
  configured: true,
  asynchronous: false,
  notes:
    "Compares a report against the archived reports in the virtual library using 5-word shingles and a MinHash signature. Runs locally; no credentials or network required.",
});

// Plain text for a report version.
//
// Prefers the editor tree the upload path already extracted, because it is
// already in the database and re-parsing the PDF is wasted work. Falls back to
// reading the stored file when the tree is absent, and caches the result on the
// version row so a re-analysis does not repeat it.
const textForVersion = async (version) => {
  if (!version) return "";

  if (version.extractedText) return version.extractedText;

  const report = await Report.findByPk(version.reportId);
  const fromTree = plainTextFromDocumentTree(report?.documentContent);
  if (fromTree) {
    await version.update({ extractedText: fromTree });
    return fromTree;
  }

  const tree = await extractPdfText(absolutePathFor(version.fileUrl));
  const fromFile = plainTextFromDocumentTree(tree);
  if (fromFile) {
    await version.update({ extractedText: fromFile });
    return fromFile;
  }

  return "";
};

// Fingerprint a library entry that has not been indexed yet.
//
// Lazy rather than done at archive time so that entries archived before this
// phase existed become comparable the first time anything is compared against
// them - no separate migration step and no admin action required.
const ensureIndexed = async (entry) => {
  if (entry.corpusSignature && entry.corpusAlgorithmVersion === ALGORITHM_VERSION) {
    return entry;
  }

  const version = await ReportVersion.findByPk(entry.reportVersionId);
  const text = await textForVersion(version);
  // Same exclusion rules as the query side: an asymmetric comparison would
  // compare a filtered report against an unfiltered one and misreport the gap.
  const fingerprint = fingerprintText(stripExcludedSections(text).text);

  if (!fingerprint.comparable) {
    // Record the attempt so it is not retried on every analysis, but leave the
    // signature null so the entry is excluded from comparison rather than
    // treated as an empty document (which would score 0 and look "clean").
    await entry.update({
      corpusWordCount: fingerprint.wordCount,
      corpusAlgorithmVersion: ALGORITHM_VERSION,
      corpusIndexedAt: new Date(),
    });
    return entry;
  }

  await entry.update({
    corpusSignature: fingerprint.signature,
    corpusShingles: fingerprint.shingles,
    corpusWordCount: fingerprint.wordCount,
    corpusAlgorithmVersion: ALGORITHM_VERSION,
    corpusIndexedAt: new Date(),
  });

  return entry;
};

// Submit = run the comparison.
//
// Returns an already-completed outcome, which the caller applies immediately.
const submit = async ({ analysis, version }) => {
  const text = await textForVersion(version);

  if (!text) {
    throw new Error(
      "No text could be extracted from this report, so it cannot be compared against the library."
    );
  }

  // Exclusion rules run before fingerprinting, so excluded material contributes
  // nothing to either side of the comparison. Post-filtering matches instead
  // would still let a fifty-entry reference list dominate the score.
  const exclusions = stripExcludedSections(text);
  const query = fingerprintText(exclusions.text);

  if (!query.comparable) {
    throw new Error(
      `The report is too short to compare (${query.wordCount} usable words after exclusions; at least 5 are needed).`
    );
  }

  // Every archived report except this one. Cross-year comparison is the whole
  // point, so the academic year is reported on each match rather than used to
  // filter candidates out.
  const candidates = await LibraryEntry.findAll({
    where: { reportVersionId: { [Op.ne]: version.id } },
    order: [["submissionDate", "DESC"]],
  });

  const screened = [];

  for (const entry of candidates) {
    const indexed = await ensureIndexed(entry);
    if (!indexed.corpusSignature) continue;

    const estimate = estimateSimilarity(query.signature, indexed.corpusSignature);
    if (estimate >= SCREEN_FLOOR) {
      screened.push({ entry: indexed, estimate });
    }
  }

  screened.sort((a, b) => b.estimate - a.estimate);
  const shortlist = screened.slice(0, MAX_CANDIDATES);

  const matches = [];
  let topScore = 0;

  for (const { entry } of shortlist) {
    const { score, shared, sharedCount } = exactSimilarity(query.shingles, entry.corpusShingles);
    if (score < MATCH_FLOOR) continue;

    if (score > topScore) topScore = score;

    // A representative excerpt: the first shared shingle's window in the
    // submitted report. The reviewer needs to recognise the reuse, not to read
    // the whole passage again.
    const firstShared = shared[0];
    const startIndex = query.firstIndexByHash?.get(firstShared);
    const excerpt = excerptAround(tokenize(exclusions.text), startIndex);

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

  // The headline number is the single highest overlap, not a sum. Summing would
  // exceed 100 % and would imply a total that no reviewer can act on.
  const internalScore = matches.length ? matches[0].similarityPercentage : 0;

  return {
    // No external scan, so nothing to correlate a webhook with.
    externalScanId: null,
    completed: {
      status: "completed",
      internalScore,
      // A label for prioritising review, not a finding of misconduct.
      plagiarismStatus: classifySimilarity(internalScore),
      excludedSections: exclusions.removedSections,
      totalWords: query.wordCount,
      matchedWords: matches.reduce((sum, match) => sum + (match.matchedWords || 0), 0),
      rawSummary: {
        algorithmVersion: ALGORITHM_VERSION,
        corpusSize: candidates.length,
        screened: screened.length,
        shortlisted: shortlist.length,
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
