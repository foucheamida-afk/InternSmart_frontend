/**
 * Composite final grade policy (FR-GRD-01 / FR-GRD-02 / FR-GRD-03).
 *
 * The two supervisor grades are expressed on different scales — academic out of
 * 20, professional out of 10 — and were previously stored side by side with
 * nothing combining them, so a student never had a single final mark.
 *
 * Each component is converted to a percentage, combined using the weights below
 * (which mirror the 20:10 point split), and projected back onto the 20-point
 * scale used for academic reporting. A perfect 20 + 10 therefore yields 20/20.
 *
 * The composite is only produced once BOTH supervisors have submitted, which is
 * what gates FR-GRD-03.
 */

export const ACADEMIC_MAX = 20;
export const PROFESSIONAL_MAX = 10;
export const COMPOSITE_MAX = 20;

// 20 of 30 points come from the academic supervisor, 10 of 30 from the professional.
export const ACADEMIC_WEIGHT = 2 / 3;
export const PROFESSIONAL_WEIGHT = 1 / 3;

export const round2 = (value) => Number(Number(value).toFixed(2));

/** Clamp a score onto the 0–100 percentage scale. */
export const toPercentage = (score, max) => {
  if (score == null || !max) return null;
  return Math.max(0, Math.min(100, (Number(score) / Number(max)) * 100));
};

/**
 * Combine both components. `ready` is false until both have been submitted, and
 * the score is null in that case rather than a misleading partial figure.
 */
export const computeComposite = ({
  academicGrade,
  academicSubmitted,
  professionalGrade,
  professionalSubmitted,
}) => {
  const weights = { academic: ACADEMIC_WEIGHT, professional: PROFESSIONAL_WEIGHT };

  const academicPercentage = academicSubmitted
    ? toPercentage(academicGrade, ACADEMIC_MAX)
    : null;
  const professionalPercentage = professionalSubmitted
    ? toPercentage(professionalGrade, PROFESSIONAL_MAX)
    : null;

  const components = {
    academic: {
      score: academicSubmitted ? round2(academicGrade) : null,
      max: ACADEMIC_MAX,
      percentage: academicPercentage == null ? null : round2(academicPercentage),
    },
    professional: {
      score: professionalSubmitted ? round2(professionalGrade) : null,
      max: PROFESSIONAL_MAX,
      percentage: professionalPercentage == null ? null : round2(professionalPercentage),
    },
  };

  if (academicPercentage == null || professionalPercentage == null) {
    return { ready: false, score: null, max: COMPOSITE_MAX, percentage: null, weights, components };
  }

  const percentage =
    academicPercentage * ACADEMIC_WEIGHT + professionalPercentage * PROFESSIONAL_WEIGHT;

  return {
    ready: true,
    score: round2((percentage / 100) * COMPOSITE_MAX),
    max: COMPOSITE_MAX,
    percentage: round2(percentage),
    weights,
    components,
  };
};

/**
 * Recompute and persist the composite onto the Internship row, reusing the
 * previously unused legacy columns (`finalGrade`, `gradeBreakdown`,
 * `gradeStatus`) as the single storage location for the combined mark.
 */
export const persistCompositeGrade = async (internship) => {
  const academicSubmitted =
    internship.academicGradeStatus === "submitted" && internship.academicGrade != null;
  const professionalSubmitted =
    internship.professionalGradeStatus === "submitted" && internship.professionalGrade != null;

  const composite = computeComposite({
    academicGrade: internship.academicGrade,
    academicSubmitted,
    professionalGrade: internship.professionalGrade,
    professionalSubmitted,
  });

  await internship.update({
    finalGrade: composite.score,
    gradeBreakdown: { ...composite, computedAt: new Date().toISOString() },
    gradeStatus: composite.ready ? "submitted" : "pending",
    gradeSubmittedAt: composite.ready ? new Date() : null,
  });

  return composite;
};
