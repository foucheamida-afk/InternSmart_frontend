// Exclusion rules for similarity comparison.
//
// A raw shingle overlap between two student reports is inflated by material that
// is *supposed* to be identical: a reference list, an appendix of boilerplate, a
// standard declaration, a table of contents. The module specification asks for
// "exclusion rules for bibliography, quotations, common phrases", and without
// them a report with fifty references looks far more similar to its neighbour
// than it is.
//
// Exclusions are applied to the text *before* fingerprinting, so excluded
// material contributes nothing to either side of the comparison. That is
// deliberately different from post-filtering matches: filtering afterwards still
// lets a reference list dominate the score.

// Headings that begin a section to be discarded. Matched case-insensitively
// against a line that looks like a heading (short, and either numbered or
// standing alone), because "References" also appears inside body sentences.
const EXCLUDED_HEADINGS = [
  "references",
  "bibliography",
  "works cited",
  "literature cited",
  "list of references",
  "sources",
  "annex",
  "appendices",
  "appendix",
  "table of contents",
  "contents",
  "declaration",
  "acknowledgements",
  "acknowledgments",
  "abbreviations",
  "list of figures",
  "list of tables",
];

// Phrases dropped wherever they occur, because they are boilerplate rather than
// an author's prose. Extend with PLAGIARISM_EXCLUDED_PHRASES (comma separated).
const DEFAULT_PHRASES = [
  "all rights reserved",
  "this report is submitted in partial fulfilment",
  "university of",
  "faculty of science",
  "department of computer",
  "supervised by",
  "academic year",
];

const configuredPhrases = () =>
  String(process.env.PLAGIARISM_EXCLUDED_PHRASES || "")
    .split(",")
    .map((phrase) => phrase.trim().toLowerCase())
    .filter(Boolean);

export const excludedPhrases = () => [...DEFAULT_PHRASES, ...configuredPhrases()];

const isHeadingLike = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Long lines are prose, not a heading, even if they contain the word.
  if (trimmed.length > 60) return false;
  // Headings are short and usually carry no sentence-ending punctuation.
  if (/[.!?;]\s*$/.test(trimmed)) return false;
  return true;
};

const normaliseHeading = (line) =>
  line
    .trim()
    .toLowerCase()
    // strip leading numbering such as "7.", "7.1", "CHAPTER 7", "SECTION 2"
    .replace(/^(chapter|section|part)\s+\d+[.:]?\s*/, "")
    .replace(/^\d+(\.\d+)*[.:]?\s*/, "")
    .replace(/[:.\s]+$/, "")
    .trim();

// Remove everything from the first excluded heading to the end of the document,
// plus any configured boilerplate phrases anywhere.
//
// "To the end" rather than "to the next heading" is a deliberate choice:
// references, appendices and declarations are conventionally terminal, and
// stopping at the next heading would leave the bulk of a multi-page bibliography
// in the comparison - which is the material that most inflates a false match.
export const stripExcludedSections = (text) => {
  const raw = String(text || "");
  if (!raw) return { text: "", removedSections: [], removedCharacters: 0 };

  const lines = raw.split(/\r?\n/);
  const removedSections = [];
  let cutoff = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (!isHeadingLike(lines[index])) continue;
    const heading = normaliseHeading(lines[index]);
    if (EXCLUDED_HEADINGS.includes(heading)) {
      cutoff = index;
      removedSections.push(lines[index].trim());
      break;
    }
  }

  const kept = cutoff >= 0 ? lines.slice(0, cutoff) : lines;
  let result = kept.join("\n");

  const before = result.length;
  for (const phrase of excludedPhrases()) {
    if (!phrase) continue;
    result = result.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }

  return {
    text: result,
    removedSections,
    // Reported so the effect of the rules is visible rather than silent: a
    // reviewer should be able to see that a bibliography was excluded.
    removedCharacters: raw.length - result.length,
  };
};

export { EXCLUDED_HEADINGS };

export default { stripExcludedSections, excludedPhrases, EXCLUDED_HEADINGS };
