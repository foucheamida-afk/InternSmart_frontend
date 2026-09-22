// Similarity severity bands.
//
// Two sources disagreed on these values: the SRS said 15 % / 25 %, and the
// module specification the user wrote said 10 / 25 / 40 with the explicit
// requirement that they "should be configurable by the school". The module
// specification is the requirement, so its values are the defaults here and the
// SRS is superseded - recorded rather than silently reconciled.
//
// The important design point is that bands are a *label*, never a verdict. A
// similarity score is not proof of misconduct: bibliographies, standard
// definitions, templates and properly quoted material all produce matches. The
// label exists to help a reviewer prioritise, and the wording below is chosen so
// that it cannot be read as an accusation.

export const BANDS = [
  {
    key: "low",
    label: "Low similarity",
    advice: "Consistent with ordinary use of shared terminology and references.",
  },
  {
    key: "moderate",
    label: "Moderate similarity",
    advice: "Worth a look at the matched sources before deciding.",
  },
  {
    key: "high",
    label: "High similarity",
    advice: "Review the matched passages; substantial overlap may need explanation.",
  },
  {
    key: "very_high",
    label: "Very high similarity",
    advice: "Substantial overlap detected. Review the matches carefully before drawing any conclusion.",
  },
];

const readBound = (name, fallback) => {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured >= 0 && configured <= 100 ? configured : fallback;
};

// Upper bound of `low`, of `moderate`, and of `high`. Anything above the last is
// `very_high`.
export const thresholds = () => {
  const low = readBound("PLAGIARISM_BAND_LOW_MAX", 10);
  const moderate = readBound("PLAGIARISM_BAND_MODERATE_MAX", 25);
  const high = readBound("PLAGIARISM_BAND_HIGH_MAX", 40);

  // Clamp so a misconfigured environment cannot produce overlapping or inverted
  // bands; the ranges must stay monotonic for classification to mean anything.
  const safeModerate = Math.max(moderate, low);
  const safeHigh = Math.max(high, safeModerate);

  return { low, moderate: safeModerate, high: safeHigh };
};

export const classifySimilarity = (score) => {
  if (typeof score !== "number" || Number.isNaN(score)) return null;

  const { low, moderate, high } = thresholds();

  if (score <= low) return "low";
  if (score <= moderate) return "moderate";
  if (score <= high) return "high";
  return "very_high";
};

export const describeBand = (key) => BANDS.find((band) => band.key === key) || null;

// Everything the client needs to render a band, including the boundaries that
// produced it, so the number and the label can never disagree on screen.
export const bandSummary = (score) => {
  const key = classifySimilarity(score);
  const band = describeBand(key);
  const { low, moderate, high } = thresholds();

  return {
    score: typeof score === "number" ? score : null,
    key,
    label: band?.label ?? null,
    advice: band?.advice ?? null,
    thresholds: { low, moderate, high },
    isEstimateOfMisconduct: false,
  };
};

export default { BANDS, thresholds, classifySimilarity, describeBand, bandSummary };
