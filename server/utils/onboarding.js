// Supervisor onboarding gate.
//
// An account created on demand for a supervisor (by the admin assigning an
// academic supervisor, by CSV import, or by a student submitting a professional
// supervisor's email) is issued temporary credentials. On first login the holder
// must change that password and then confirm their profile details before the
// supervisor surfaces open up.
//
// Accounts that existed before this feature were backfilled as already onboarded
// (see `ensureUserOnboardingColumns` in server.js), so an established supervisor
// is never pushed back through onboarding - only a genuinely new account is.

export const SUPERVISOR_ROLES = ["academic_supervisor", "professional_supervisor"];

// True only for a supervisor account whose profile has not been confirmed.
export const requiresOnboarding = (user) =>
  Boolean(user) &&
  SUPERVISOR_ROLES.includes(user.role) &&
  !user.onboardingCompletedAt;

export default requiresOnboarding;
