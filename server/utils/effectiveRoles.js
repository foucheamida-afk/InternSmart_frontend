import Internship from "../models/studentAssignmentModel.js";

// A single person can legitimately supervise more than one student in more than
// one capacity: the same lecturer may be the academic supervisor for student A
// and the professional supervisor for student B (e.g. a lecturer who also
// mentors an intern at their own company). `User.role` cannot express that - it
// is a single ENUM column - and `User.email` is UNIQUE, so one person is always
// exactly one account.
//
// The relationship is what actually carries the capacity: `Internship` records
// the person in either the `academicSupervisorId` or the `professionalSupervisorId`
// column. So the account's `role` is treated as its *primary* role (what it was
// provisioned as, and where the client routes it by default), and a supervisor
// capability is granted as soon as at least one internship references the person
// in the matching column.
//
// This is the single source of truth for "what may this account do" and is used
// both by the role guard on the server and by the login payload the client
// routes on, so the two can never disagree.
const SUPERVISOR_ROLES = ["academic_supervisor", "professional_supervisor"];

export const getEffectiveRoles = async (user) => {
  if (!user) return [];

  const roles = new Set([user.role]);

  // Only supervisor accounts can gain a second supervisor capability. Students
  // and admins are never referenced by these columns, so skipping them also
  // avoids two needless counts on the hot path for every student request.
  if (!SUPERVISOR_ROLES.includes(user.role)) {
    return [...roles];
  }

  const [academicCount, professionalCount] = await Promise.all([
    Internship.count({ where: { academicSupervisorId: user.id } }),
    Internship.count({ where: { professionalSupervisorId: user.id } }),
  ]);

  if (academicCount > 0) roles.add("academic_supervisor");
  if (professionalCount > 0) roles.add("professional_supervisor");

  return [...roles];
};

export const hasAnyRole = (effectiveRoles, allowedRoles) =>
  allowedRoles.some((role) => effectiveRoles.includes(role));

export default getEffectiveRoles;
