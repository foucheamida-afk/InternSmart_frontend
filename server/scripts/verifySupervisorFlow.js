// Verification for the supervisor-provisioning workflow.
//
// Exercises the shared provisioning service and the effective-role resolver
// against the real database, using .invalid addresses (RFC 2606 - guaranteed
// never to resolve) so no real mail can be delivered, then removes everything it
// created. Run with: node scripts/verifySupervisorFlow.js
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Notification from "../models/notificationModel.js";
import { getEffectiveRoles, hasAnyRole } from "../utils/effectiveRoles.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  findOrCreateSupervisor,
  linkSupervisorToStudent,
  notifySupervisorAssignment,
  SupervisorProvisioningError,
} from "../services/supervisorProvisioning.js";

const TAG = `vsf${Date.now()}`;
const mail = (n) => `${TAG}-${n}@example.invalid`;

const created = { users: [], students: [], internships: [] };
let failures = 0;

const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const makeUser = async (name, email, role) => {
  const user = await User.create({
    name,
    email,
    password: "not-a-real-hash",
    role,
    mustChangePassword: false,
    active: true,
  });
  created.users.push(user.id);
  return user;
};

const makeStudent = async (name, email) => {
  const user = await makeUser(name, email, "student");
  const student = await Student.create({
    userId: user.id,
    matricule: `M-${TAG}-${user.id}`,
    class: "Verification",
  });
  created.students.push(student.id);
  return { user, student };
};

const expectThrow = async (name, fn, matcher) => {
  try {
    await fn();
    check(name, false, "expected a rejection but it resolved");
  } catch (error) {
    check(name, error instanceof SupervisorProvisioningError && (!matcher || matcher.test(error.message)), error.message);
  }
};

const run = async () => {
  await sequelize.authenticate();

  // --- 1. Unknown email => account created, credentials generated ------------
  const first = await findOrCreateSupervisor({
    email: mail("lecturer"),
    name: "Prof Ada",
    role: "academic_supervisor",
  });
  created.users.push(first.user.id);

  check("creates an account when the supervisor email is unknown", first.created === true);
  check("created account has the requested role", first.user.role === "academic_supervisor", first.user.role);
  check("created account must change its temporary password", first.user.mustChangePassword === true);
  check("a temporary password is returned once", typeof first.temporaryPassword === "string" && first.temporaryPassword.length >= 8);

  // --- 2. Known email => reused, not duplicated ------------------------------
  const second = await findOrCreateSupervisor({
    email: mail("lecturer"),
    name: "Prof Ada",
    role: "academic_supervisor",
  });
  check("reuses the existing account on a second lookup", second.created === false && second.user.id === first.user.id);
  check("no temporary password is generated for a reused account", second.temporaryPassword === null);

  // --- 3. The case that previously crashed ----------------------------------
  // Same person, the OTHER supervisor role. The old lookup was
  // `findOne({ email, role })`, which missed this account and then attempted
  // User.create with a duplicate email => UNIQUE constraint violation.
  const crossRole = await findOrCreateSupervisor({
    email: mail("lecturer"),
    name: "Prof Ada",
    role: "professional_supervisor",
  });
  check(
    "reuses the account when the same person is added under the other supervisor role",
    crossRole.created === false && crossRole.user.id === first.user.id
  );

  const userCount = await User.count({ where: { email: mail("lecturer") } });
  check("exactly one account exists for that email", userCount === 1, `count=${userCount}`);

  // --- 4. Linking, including creation of a missing internship row -----------
  const studentA = await makeStudent("Student A", mail("studentA"));
  const studentB = await makeStudent("Student B", mail("studentB"));

  const internshipA = await linkSupervisorToStudent({
    studentId: studentA.student.id,
    role: "academic_supervisor",
    supervisorId: first.user.id,
    company: "Acme",
  });
  created.internships.push(internshipA.id);

  check("creates an internship row for a student who had none", Boolean(internshipA.id));
  check("sets the academic supervisor on the new internship", internshipA.academicSupervisorId === first.user.id);
  check("stores the company on the new internship", internshipA.company === "Acme", internshipA.company);

  const internshipB = await linkSupervisorToStudent({
    studentId: studentB.student.id,
    role: "professional_supervisor",
    supervisorId: first.user.id,
    company: "Globex",
  });
  created.internships.push(internshipB.id);
  check("sets the professional supervisor for the second student", internshipB.professionalSupervisorId === first.user.id);

  // --- 5. One person, both roles, derived from the relationships ------------
  const dualRoles = await getEffectiveRoles(first.user);
  check(
    "the same person holds both supervisor roles across two students",
    dualRoles.includes("academic_supervisor") && dualRoles.includes("professional_supervisor"),
    dualRoles.join(", ")
  );

  // --- 6. Updating an existing internship rather than duplicating it --------
  const replacement = await makeUser("Prof Grace", mail("replacement"), "academic_supervisor");
  const relinked = await linkSupervisorToStudent({
    studentId: studentA.student.id,
    role: "academic_supervisor",
    supervisorId: replacement.id,
  });
  const internshipCountA = await Internship.count({ where: { studentId: studentA.student.id } });
  check("relinking updates the same internship row", relinked.id === internshipA.id && internshipCountA === 1, `rows=${internshipCountA}`);
  check("relinking moves the supervisor", relinked.academicSupervisorId === replacement.id);
  check("relinking leaves the company untouched when none is supplied", relinked.company === "Acme", relinked.company);

  // --- 7. Rejections -------------------------------------------------------
  await expectThrow(
    "rejects a student's own email as a supervisor",
    () => findOrCreateSupervisor({ email: studentA.user.email, role: "professional_supervisor" }),
    /student account/
  );

  const admin = await makeUser("Admin", mail("admin"), "admin");
  await expectThrow(
    "rejects an administrator email as a supervisor",
    () => findOrCreateSupervisor({ email: admin.email, role: "academic_supervisor" }),
    /administrator account/
  );

  await expectThrow(
    "rejects a malformed email",
    () => findOrCreateSupervisor({ email: "not-an-email", role: "academic_supervisor" }),
    /not a valid email/
  );

  // --- 8. Effective roles for ordinary accounts ----------------------------
  const studentRoles = await getEffectiveRoles(studentA.user);
  check("a student's effective roles are just ['student']", studentRoles.length === 1 && studentRoles[0] === "student", studentRoles.join(", "));
  check("hasAnyRole intersects correctly", hasAnyRole(dualRoles, ["academic_supervisor"]) && !hasAnyRole(studentRoles, ["academic_supervisor"]));

  // --- 9. The role guard admits a dual-role account ------------------------
  // `replacement` is primary academic_supervisor and IS also the professional
  // supervisor for nobody yet; link them professionally to student B's peer and
  // then check a professional-only guard admits them.
  await linkSupervisorToStudent({
    studentId: studentB.student.id,
    role: "professional_supervisor",
    supervisorId: replacement.id,
  });

  let nextCalled = false;
  const professionalGuard = authorize("professional_supervisor");
  await professionalGuard(
    { user: { id: replacement.id, role: "academic_supervisor", onboardingCompletedAt: new Date() } },
    mockRes(),
    () => {
      nextCalled = true;
    }
  );
  check("academic-primary account passes a professional-supervisor guard once linked", nextCalled === true);

  // The role guard now also enforces the profile-onboarding gate, so a mock
  // `req.user` must carry `onboardingCompletedAt` exactly as `protect` sets it.
  let pendingNextCalled = false;
  const pendingRes = mockRes();
  await professionalGuard(
    { user: { id: replacement.id, role: "academic_supervisor", onboardingCompletedAt: null } },
    pendingRes,
    () => {
      pendingNextCalled = true;
    }
  );
  check(
    "a supervisor awaiting onboarding is refused by the guard",
    pendingNextCalled === false && pendingRes.statusCode === 403 && pendingRes.body?.code === "ONBOARDING_REQUIRED",
    `status=${pendingRes.statusCode} code=${pendingRes.body?.code}`
  );

  // A student must not be caught by the onboarding gate: it only applies to
  // supervisor roles, even on an endpoint that admits supervisors.
  let studentOnboardingNext = false;
  const studentOnboardingRes = mockRes();
  await professionalGuard(
    { user: { id: studentA.user.id, role: "student", onboardingCompletedAt: null } },
    studentOnboardingRes,
    () => {
      studentOnboardingNext = true;
    }
  );
  check(
    "the onboarding gate does not fire for a non-supervisor",
    studentOnboardingNext === false && studentOnboardingRes.statusCode === 403 && studentOnboardingRes.body?.code === undefined,
    `status=${studentOnboardingRes.statusCode}`
  );

  let studentNextCalled = false;
  const studentGuardRes = mockRes();
  await authorize("professional_supervisor")(
    { user: { id: studentA.user.id, role: "student", onboardingCompletedAt: null } },
    studentGuardRes,
    () => {
      studentNextCalled = true;
    }
  );
  check("a student is still refused by a supervisor guard", studentNextCalled === false && studentGuardRes.statusCode === 403, `status=${studentGuardRes.statusCode}`);

  // --- 10. Notification never throws ---------------------------------------
  const notification = await notifySupervisorAssignment({
    supervisor: first.user,
    created: false,
    temporaryPassword: null,
    role: "professional_supervisor",
    studentName: "Student B",
    studentEmail: studentB.user.email,
    company: "Globex",
  });
  check("notification reports the email outcome without throwing", typeof notification.warning === "string" || notification.emailSent === true, notification.warning || "email accepted by SMTP");
  check("an in-app notification is still recorded", notification.notified === true);

  const inApp = await Notification.count({ where: { userId: first.user.id } });
  check("the in-app notification row exists", inApp >= 1, `rows=${inApp}`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
};

const cleanup = async () => {
  try {
    await Notification.destroy({ where: { userId: created.users } });
    await Internship.destroy({ where: { studentId: created.students } });
    await Student.destroy({ where: { id: created.students } });
    await User.destroy({ where: { id: created.users } });
    console.log(`\ncleanup: removed ${created.users.length} users, ${created.students.length} students, ${created.internships.length} internships`);
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
};

try {
  await run();
} catch (error) {
  failures++;
  console.error("VERIFICATION ERROR:", error);
} finally {
  await cleanup();
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
}
