import bcrypt from "bcrypt";
import User from "../models/userModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Notification from "../models/notificationModel.js";
import generateTemporaryPassword from "../utils/generatePassword.js";
import sendAccountEmail, { sendSupervisorAssignmentEmail, roleLabel } from "../utils/sendEmail.js";

// Single implementation of "attach a supervisor to a student", shared by every
// entry point that can do it:
//   - the admin's single-student creation form,
//   - the admin's bulk CSV import,
//   - the student entering their professional supervisor's email.
//
// Before this existed the logic was written inline twice in the CSV importer and
// not at all elsewhere, which is why the admin form could not assign a supervisor
// and why a reused supervisor was linked silently with no notification.
export const SUPERVISOR_ROLES = ["academic_supervisor", "professional_supervisor"];

export class SupervisorProvisioningError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SupervisorProvisioningError";
    this.status = status;
  }
}

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Find the account for an email address, or create one.
//
// Lookup is intentionally by EMAIL ALONE, not by `{ email, role }`. The previous
// role-scoped lookup missed a person who already had the *other* supervisor role
// and then attempted `User.create` with a duplicate email, which the UNIQUE
// constraint rejected - so linking a lecturer who was already an academic
// supervisor as a professional supervisor failed outright. Since one person is
// one account, a hit on either supervisor role is a valid reuse; the capacity is
// carried by which column of `Internship` the id lands in, and
// `getEffectiveRoles` derives access from exactly that.
export const findOrCreateSupervisor = async ({ email, name, role, transaction }) => {
  if (!SUPERVISOR_ROLES.includes(role)) {
    throw new SupervisorProvisioningError(`Unsupported supervisor role: ${role}`, 500);
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new SupervisorProvisioningError("A supervisor email address is required");
  }
  if (!isValidEmail(normalized)) {
    throw new SupervisorProvisioningError(`"${email}" is not a valid email address`);
  }

  const existing = await User.findOne({ where: { email: normalized }, transaction });
  if (existing) {
    if (existing.role === "student") {
      throw new SupervisorProvisioningError(
        "That email belongs to a student account, so it cannot be used as a supervisor."
      );
    }
    if (existing.role === "admin") {
      throw new SupervisorProvisioningError(
        "That email belongs to an administrator account, so it cannot be used as a supervisor."
      );
    }
    if (existing.active === false) {
      throw new SupervisorProvisioningError(
        "That supervisor account is deactivated. Reactivate it before assigning new students."
      );
    }

    return { user: existing, created: false, temporaryPassword: null };
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await User.create(
    {
      name: name?.trim() || normalized,
      email: normalized,
      password: await bcrypt.hash(temporaryPassword, 10),
      role,
      mustChangePassword: true,
      active: true,
    },
    { transaction }
  );

  return { user, created: true, temporaryPassword };
};

// Attach a supervisor to a student's internship, creating the internship row if
// the student does not have one yet. This matters for the student-driven flow:
// a student created before finding an internship has no Internship row at all.
export const linkSupervisorToStudent = async ({
  studentId,
  role,
  supervisorId,
  company,
  transaction,
}) => {
  const column =
    role === "academic_supervisor" ? "academicSupervisorId" : "professionalSupervisorId";

  const existing = await Internship.findOne({ where: { studentId }, transaction });

  if (!existing) {
    return Internship.create(
      {
        studentId,
        [column]: supervisorId,
        ...(company !== undefined ? { company } : {}),
      },
      { transaction }
    );
  }

  const updates = { [column]: supervisorId };
  if (company !== undefined) updates.company = company;
  await existing.update(updates, { transaction });
  return existing;
};

// Tell the supervisor they have a new student. Must be called AFTER the
// surrounding transaction commits: sending mail inside the transaction would
// mail credentials for a row that a later rollback could erase.
//
// Never throws. A failed notification must not report the assignment itself as
// failed - the link is already committed at this point.
export const notifySupervisorAssignment = async ({
  supervisor,
  created,
  temporaryPassword,
  role,
  studentName,
  studentEmail,
  company,
}) => {
  const result = { emailSent: false, notified: false, warning: null };

  try {
    if (created) {
      await sendAccountEmail({
        to: supervisor.email,
        name: supervisor.name,
        password: temporaryPassword,
        role,
        studentName,
        studentEmail,
        company,
      });
    } else {
      await sendSupervisorAssignmentEmail({
        to: supervisor.email,
        name: supervisor.name,
        role,
        studentName,
        studentEmail,
        company,
      });
    }
    result.emailSent = true;
  } catch (error) {
    result.warning = `Account linked, but the notification email failed: ${error.message}`;
    console.warn("SUPERVISOR ASSIGNMENT EMAIL ERROR:", error.message);
  }

  try {
    await Notification.create({
      userId: supervisor.id,
      title: created ? "Welcome to InternSmart" : "New student assigned to you",
      message: created
        ? `Your ${roleLabel(role)} account has been created and ${studentName} has been assigned to you. Please change your temporary password on first login.`
        : `${studentName} has been assigned to you as your student (${roleLabel(role)}).`,
      type: "info",
    });
    result.notified = true;
  } catch (error) {
    console.warn("SUPERVISOR ASSIGNMENT NOTIFICATION ERROR:", error.message);
  }

  return result;
};

// Convenience wrapper for callers that are not already inside a transaction and
// want the whole sequence: resolve the account, link it, then notify.
export const assignSupervisorToStudent = async ({
  studentId,
  studentName,
  studentEmail,
  role,
  email,
  name,
  company,
  transaction,
}) => {
  const { user, created, temporaryPassword } = await findOrCreateSupervisor({
    email,
    name,
    role,
    transaction,
  });

  await linkSupervisorToStudent({
    studentId,
    role,
    supervisorId: user.id,
    company,
    transaction,
  });

  return { supervisor: user, created, temporaryPassword };
};

export default assignSupervisorToStudent;
