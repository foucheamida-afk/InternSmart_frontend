// Temporary end-to-end check of the profile-completion onboarding gate.
// Requires the API server to be running.
import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Notification from "../models/notificationModel.js";

const BASE = "http://localhost:3000/api";
const TAG = `von${Date.now()}`;
const PASSWORD = "VerifyPass123!";
const NEW_PASSWORD = "VerifyPass456!";

const ids = { users: [], students: [] };
let failures = 0;

const check = (name, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const mail = (n) => `${TAG}-${n}@example.invalid`;

const makeUser = async (name, email, role, extras = {}) => {
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(PASSWORD, 10),
    role,
    mustChangePassword: false,
    active: true,
    ...extras,
  });
  ids.users.push(user.id);
  return user;
};

const login = async (email, password) => {
  const res = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, data: await res.json() };
};

try {
  await sequelize.authenticate();

  // A freshly provisioned supervisor: created on demand, profile not confirmed.
  const gated = await makeUser("Gated Supervisor", mail("gated"), "academic_supervisor", {
    mustChangePassword: true,
    onboardingCompletedAt: null,
  });
  // An established supervisor: what the backfill produces.
  const established = await makeUser("Established Supervisor", mail("established"), "academic_supervisor", {
    onboardingCompletedAt: new Date(),
  });
  const admin = await makeUser("Temp Admin", mail("admin"), "admin");
  const student = await makeUser("Temp Student", mail("student"), "student");
  const studentRow = await Student.create({ userId: student.id, matricule: `M-${TAG}`, class: "Verification" });
  ids.students.push(studentRow.id);

  const adminLogin = await login(admin.email, PASSWORD);
  const adminAuth = { Authorization: `Bearer ${adminLogin.data.token}`, "Content-Type": "application/json" };

  // --- A. A gated supervisor is told about BOTH gates at login -------------
  const gatedLogin = await login(gated.email, PASSWORD);
  check("gated supervisor login succeeds", gatedLogin.status === 200, `status=${gatedLogin.status}`);
  check("password change is required first", gatedLogin.data.requiresPasswordChange === true);
  check("onboarding is also signalled", gatedLogin.data.requiresOnboarding === true);
  check("the flag is on the stored user object too", gatedLogin.data.user?.requiresOnboarding === true);

  const gatedAuth = { Authorization: `Bearer ${gatedLogin.data.token}`, "Content-Type": "application/json" };

  // --- B. The supervisor surface is refused while onboarding is pending ----
  const blocked = await fetch(`${BASE}/supervisor/my-interns`, { headers: gatedAuth });
  const blockedData = await blocked.json();
  check("supervisor route is refused before onboarding", blocked.status === 403, `status=${blocked.status}`);
  check("the refusal carries ONBOARDING_REQUIRED", blockedData.code === "ONBOARDING_REQUIRED", blockedData.code);

  // --- C. But the screen that un-gates it stays reachable ------------------
  const profile = await fetch(`${BASE}/users/me`, { headers: gatedAuth });
  const profileData = await profile.json();
  check("GET /api/users/me is reachable while gated", profile.status === 200, `status=${profile.status}`);
  check("it reports requiresOnboarding", profileData.user?.requiresOnboarding === true);
  check("profile fields start empty", !profileData.user?.phone && !profileData.user?.organisation && !profileData.user?.jobTitle);

  // --- D. Partial submissions are rejected --------------------------------
  const partial = await fetch(`${BASE}/users/me/onboarding`, {
    method: "PUT",
    headers: gatedAuth,
    body: JSON.stringify({ name: "Gated Supervisor", phone: "+237 600 000 000" }),
  });
  const partialData = await partial.json();
  check("a partial profile is refused", partial.status === 400, `status=${partial.status}`);
  check("the missing fields are named", Array.isArray(partialData.missing) && partialData.missing.length === 2, JSON.stringify(partialData.missing));

  // --- E. Completing onboarding -------------------------------------------
  const complete = await fetch(`${BASE}/users/me/onboarding`, {
    method: "PUT",
    headers: gatedAuth,
    body: JSON.stringify({
      name: "Dr. Gated Supervisor",
      phone: "+237 600 000 000",
      organisation: "University of Buea — Computer Science",
      jobTitle: "Senior Lecturer",
    }),
  });
  const completeData = await complete.json();
  check("a full profile is accepted", complete.status === 200, `status=${complete.status}`);
  check("it is reported as first completion", completeData.completedOnboarding === true);
  check("the returned profile is no longer gated", completeData.user?.requiresOnboarding === false);
  check("the name was updated on the account", completeData.user?.name === "Dr. Gated Supervisor", completeData.user?.name);

  // A fresh token is needed: the JWT still carries the old name, and `protect`
  // only refreshes role + onboarding from the database.
  const afterLogin = await login(gated.email, PASSWORD);
  const afterAuth = { Authorization: `Bearer ${afterLogin.data.token}`, "Content-Type": "application/json" };
  check("login no longer requests onboarding", afterLogin.data.requiresOnboarding === false);

  // --- F. The supervisor surface opens up ---------------------------------
  const allowed = await fetch(`${BASE}/supervisor/my-interns`, { headers: afterAuth });
  check("supervisor route is allowed after onboarding", allowed.status === 200, `status=${allowed.status}`);

  // --- G. Re-submitting edits the profile without re-dating completion ----
  const firstCompletionAt = (await User.findByPk(gated.id)).onboardingCompletedAt;
  const edit = await fetch(`${BASE}/users/me/onboarding`, {
    method: "PUT",
    headers: afterAuth,
    body: JSON.stringify({
      name: "Dr. Gated Supervisor",
      phone: "+237 611 111 111",
      organisation: "University of Buea — Computer Science",
      jobTitle: "Associate Professor",
    }),
  });
  const editData = await edit.json();
  const secondCompletionAt = (await User.findByPk(gated.id)).onboardingCompletedAt;
  check("editing the profile is allowed", edit.status === 200, `status=${edit.status}`);
  check("it is not counted as a first completion", editData.completedOnboarding === false);
  check("the completion date is preserved", String(firstCompletionAt) === String(secondCompletionAt));
  check("the edit took effect", (await User.findByPk(gated.id)).jobTitle === "Associate Professor");

  // --- H. An established supervisor is never gated ------------------------
  const establishedLogin = await login(established.email, PASSWORD);
  check("established supervisor does not require onboarding", establishedLogin.data.requiresOnboarding === false);
  const establishedAuth = { Authorization: `Bearer ${establishedLogin.data.token}`, "Content-Type": "application/json" };
  check("established supervisor reaches the dashboard surface", (await fetch(`${BASE}/supervisor/my-interns`, { headers: establishedAuth })).status === 200);

  // --- I. Changing the password keeps the onboarding flag intact ----------
  const second = await makeUser("Second Gated", mail("second"), "professional_supervisor", {
    mustChangePassword: true,
    onboardingCompletedAt: null,
  });
  const secondLogin = await login(second.email, PASSWORD);
  const changeRes = await fetch(`${BASE}/users/change-password`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${secondLogin.data.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    }),
  });
  const changeData = await changeRes.json();
  check("password change succeeds", changeRes.status === 200, `status=${changeRes.status}`);
  check("change-password reports onboarding still pending", changeData.requiresOnboarding === true);

  // --- J. A NEWLY provisioned supervisor is gated; a REUSED one is not ----
  const newSupervisorEmail = mail("provisioned");
  const createOne = await fetch(`${BASE}/admin/users`, {
    method: "POST",
    headers: adminAuth,
    body: JSON.stringify({
      name: "Provisioned Prof",
      email: mail("studentA"),
      role: "student",
      matricule: `M-${TAG}-A`,
      class: "Verification",
      academicSupervisorEmail: newSupervisorEmail,
      academicSupervisorName: "Provisioned Prof",
    }),
  });
  const createOneData = await createOne.json();
  check("admin created the student with a supervisor", createOne.status === 201, `status=${createOne.status}`);
  if (createOneData.user?.id) ids.users.push(createOneData.user.id);
  if (createOneData.academicSupervisor?.id) ids.users.push(createOneData.academicSupervisor.id);
  const createdStudentA = await Student.findOne({ where: { userId: createOneData.user.id } });
  if (createdStudentA) ids.students.push(createdStudentA.id);

  const provisioned = await User.findOne({ where: { email: newSupervisorEmail } });
  check("the newly provisioned supervisor starts un-onboarded", provisioned?.onboardingCompletedAt === null);

  // Reusing the ESTABLISHED supervisor for a second student must not re-gate.
  const createTwo = await fetch(`${BASE}/admin/users`, {
    method: "POST",
    headers: adminAuth,
    body: JSON.stringify({
      name: "Second Student",
      email: mail("studentB"),
      role: "student",
      matricule: `M-${TAG}-B`,
      class: "Verification",
      academicSupervisorEmail: established.email,
      academicSupervisorName: "Established Supervisor",
    }),
  });
  const createTwoData = await createTwo.json();
  check("the established supervisor was reused", createTwoData.academicSupervisor?.accountCreated === false, JSON.stringify(createTwoData.academicSupervisor));
  if (createTwoData.user?.id) ids.users.push(createTwoData.user.id);
  const createdStudentB = await Student.findOne({ where: { userId: createTwoData.user.id } });
  if (createdStudentB) ids.students.push(createdStudentB.id);

  const establishedRelogin = await login(established.email, PASSWORD);
  check("reuse did not re-gate the established supervisor", establishedRelogin.data.requiresOnboarding === false);

  // --- K. Students and admins are unaffected by the gate ------------------
  const studentLogin = await login(student.email, PASSWORD);
  check("a student never requires onboarding", studentLogin.data.requiresOnboarding === false);
  const adminRelogin = await login(admin.email, PASSWORD);
  check("an admin never requires onboarding", adminRelogin.data.requiresOnboarding === false);

  // --- L. Non-supervisors cannot claim a supervisor profile ---------------
  const studentOnboarding = await fetch(`${BASE}/users/me/onboarding`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${studentLogin.data.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Student",
      phone: "1",
      organisation: "2",
      jobTitle: "3",
    }),
  });
  check("a student is refused the supervisor onboarding endpoint", studentOnboarding.status === 400, `status=${studentOnboarding.status}`);

  console.log(`\n${failures === 0 ? "ALL ONBOARDING CHECKS PASSED" : `${failures} ONBOARDING CHECK(S) FAILED`}`);
} catch (error) {
  failures++;
  console.error("ONBOARDING VERIFICATION ERROR:", error);
} finally {
  try {
    await Notification.destroy({ where: { userId: ids.users } });
    await Internship.destroy({ where: { studentId: ids.students } });
    await Student.destroy({ where: { id: ids.students } });
    await User.destroy({ where: { id: ids.users } });
    console.log(`cleanup: removed ${ids.users.length} users, ${ids.students.length} students`);
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
}
