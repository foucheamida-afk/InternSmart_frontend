import { getEffectiveRoles, hasAnyRole } from "../utils/effectiveRoles.js";
import { SUPERVISOR_ROLES, requiresOnboarding } from "../utils/onboarding.js";

// Role checks consult the account's *effective* roles rather than only its
// primary `role` column, so a lecturer who is the academic supervisor for one
// student and the professional supervisor for another can reach both surfaces
// through the single account the UNIQUE email constraint allows.
//
// The lookup costs up to two COUNTs, so the result is memoised on the request:
// routes commonly stack two guards (e.g. `protect, supervisorOnly`) and the
// answer cannot change within one request.
//
// This is also where the onboarding gate is enforced. Every supervisor-facing
// route passes a supervisor role to this function, so a freshly provisioned
// supervisor who has not confirmed their profile is refused here - without
// touching a single route definition. The onboarding and profile endpoints are
// deliberately mounted under `/api/users` behind `protect` alone (no role
// guard), so a gated account can always reach the screens that un-gate it.
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    try {
      if (!req.effectiveRoles) {
        req.effectiveRoles = await getEffectiveRoles(req.user);
      }

      if (!hasAnyRole(req.effectiveRoles, allowedRoles)) {
        return res.status(403).json({
          message: "Access denied",
        });
      }

      // Only relevant when the route actually admits a supervisor.
      const routeAdmitsSupervisor = allowedRoles.some((role) =>
        SUPERVISOR_ROLES.includes(role)
      );

      if (routeAdmitsSupervisor && requiresOnboarding(req.user)) {
        return res.status(403).json({
          message: "Please complete your profile before continuing.",
          code: "ONBOARDING_REQUIRED",
        });
      }

      next();
    } catch (error) {
      console.error("ROLE AUTHORIZATION ERROR:", error);
      return res.status(500).json({
        message: "Server error while checking permissions",
        error: error.message,
      });
    }
  };
};

export default authorize;
