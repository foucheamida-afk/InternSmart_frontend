// The academic year an internship or an archived report belongs to.
//
// This is the field the user's original note turned on: "internship belongs to a
// particular academic year", because the problem being solved is students
// reusing reports from *previous* cohorts. Without a year on the records, a
// similarity match cannot distinguish "the same topic, two years apart" from
// "the same cohort, same assignment".
//
// The start month is configurable because institutions differ: a September start
// gives "2025/2026" for anything from September 2025 to August 2026. Set
// ACADEMIC_YEAR_START_MONTH in the environment to change it.
const DEFAULT_START_MONTH = 9;

const startMonth = () => {
  const configured = Number(process.env.ACADEMIC_YEAR_START_MONTH);
  return Number.isInteger(configured) && configured >= 1 && configured <= 12
    ? configured
    : DEFAULT_START_MONTH;
};

// "2025/2026" for a date inside that academic year.
export const academicYearFor = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const month = date.getMonth() + 1;
  const startYear = month >= startMonth() ? date.getFullYear() : date.getFullYear() - 1;

  return `${startYear}/${startYear + 1}`;
};

// Normalise whatever a person typed into the same "YYYY/YYYY" shape, or return
// null so the caller can fall back to deriving it. Accepts "2025/2026",
// "2025-2026" and a bare "2025".
export const normalizeAcademicYear = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const range = raw.match(/^(\d{4})\s*[/-]\s*(\d{4})$/);
  if (range) {
    const [, start, end] = range;
    return Number(end) === Number(start) + 1 ? `${start}/${end}` : null;
  }

  const single = raw.match(/^(\d{4})$/);
  if (single) {
    const start = Number(single[1]);
    return `${start}/${start + 1}`;
  }

  return null;
};

export default academicYearFor;
