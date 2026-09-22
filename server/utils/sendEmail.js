import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;

if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
  console.error("EMAIL NOT CONFIGURED: Set EMAIL_USER, EMAIL_PASS, and EMAIL_FROM in server/.env");
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

export const verifyEmailConnection = async () => {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    throw new Error("Email service is not configured on the server.");
  }
  await transporter.verify();
  return true;
};

// Human-readable role label, used by every supervisor-facing template.
export const roleLabel = (role) =>
  role === "academic_supervisor"
    ? "Academic Supervisor"
    : role === "professional_supervisor"
      ? "Professional Supervisor"
      : role === "admin"
        ? "Administrator"
        : "Student";

// Shared block describing the student an account has just been linked to.
// `studentName` is optional: when absent (e.g. an admin creating a bare
// supervisor account) the assignment sentence is omitted entirely.
const assignmentLines = ({ role, studentName, studentEmail, company }) => {
  if (!studentName) return { html: "", text: "" };

  const roleText = roleLabel(role).toLowerCase();
  const context = company ? ` at ${company}` : "";

  return {
    html: `<p>You have been assigned as the <strong>${roleText}</strong> for <strong>${studentName}</strong>${context}${studentEmail ? ` (${studentEmail})` : ""}.</p>`,
    text: `You have been assigned as the ${roleText} for ${studentName}${context}${studentEmail ? ` (${studentEmail})` : ""}.`,
  };
};

const sendAccountEmail = async ({ to, name, password, role, studentName, studentEmail, company }) => {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    throw new Error("Email service is not configured on the server.");
  }

  const subject = "Your InternSmart Account Has Been Created";

  // Configurable so credential emails point at the deployed portal instead of
  // localhost. Read lazily so it reflects the loaded .env.
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  const assignment = assignmentLines({ role, studentName, studentEmail, company });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2c3e50;">Welcome to InternSmart</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your ${roleLabel(role)} account has been created on InternSmart.</p>
      ${assignment.html}
      <p><strong>Email:</strong> ${to}</p>
      <p><strong>Temporary Password:</strong> <code style="background: #f4f4f4; padding: 4px 8px; border-radius: 4px;">${password}</code></p>
      <p style="color: #e74c3c;"><strong>Important:</strong> You are required to change this password upon your first login.</p>
      <p>Please log in at: <a href="${clientUrl}" style="color: #3498db;">InternSmart Portal</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">If you did not expect this email, please contact your administrator.</p>
    </div>
  `;

  const text = `
Welcome to InternSmart

Hello ${name},

Your ${roleLabel(role)} account has been created on InternSmart.

${assignment.text}

Email: ${to}
Temporary Password: ${password}

Important: You are required to change this password upon your first login.

Please log in at: ${clientUrl}

If you did not expect this email, please contact your administrator.
  `;

  const info = await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  return info;
};

// Sent when a student/supervisor is linked to an account that ALREADY exists.
// There are no credentials to send in that case, but the holder still has to be
// told that a new student now appears on their dashboard - that notification was
// simply never implemented before, so a reused supervisor was linked silently.
export const sendSupervisorAssignmentEmail = async ({
  to,
  name,
  role,
  studentName,
  studentEmail,
  company,
}) => {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    throw new Error("Email service is not configured on the server.");
  }

  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const roleText = roleLabel(role);
  const subject = `InternSmart: New student assigned to you${studentName ? ` - ${studentName}` : ""}`;

  const text = `
InternSmart - New Student Assignment

Hello ${name},

You have been assigned as the ${roleText.toLowerCase()} for ${studentName}${studentEmail ? ` (${studentEmail})` : ""}${company ? ` at ${company}` : ""}.

An InternSmart account already exists for this email address, so no new account was created and your existing password is unchanged.

Please log in at ${clientUrl} to view this student.

If you did not expect this, please contact your administrator.
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2c3e50;">New Student Assignment</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>You have been assigned as the <strong>${roleText.toLowerCase()}</strong> for <strong>${studentName}</strong>${company ? ` at ${company}` : ""}${studentEmail ? ` (${studentEmail})` : ""}.</p>
      <p>An InternSmart account already exists for this email address, so no new account was created and your existing password is unchanged.</p>
      <p>Please log in at <a href="${clientUrl}" style="color: #3498db;">InternSmart Portal</a> to view this student.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">If you did not expect this, please contact your administrator.</p>
    </div>
  `;

  return transporter.sendMail({ from: EMAIL_FROM, to, subject, text, html });
};

export const sendDefenseAlertEmail = async ({ to, name, title, message, defenseDate }) => {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    throw new Error("Email service is not configured on the server.");
  }

  const formattedDate = defenseDate
    ? new Date(defenseDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "To be announced";

  const subject = `InternSmart Defense Alert: ${title}`;
  const text = `
InternSmart Defense Alert

Hello ${name},

${message}

Defense date: ${formattedDate}
Please log in to InternSmart for more details.
  `;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2c3e50;">Defense Alert</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <h3>${title}</h3>
      <p>${message}</p>
      <p><strong>Defense date:</strong> ${formattedDate}</p>
      <p>Please log in to InternSmart for more details.</p>
    </div>
  `;

  return transporter.sendMail({ from: EMAIL_FROM, to, subject, text, html });
};

export const sendPasswordResetEmail = async ({ to, name, code, expiresInMinutes = 15 }) => {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    throw new Error("Email service is not configured on the server.");
  }

  const subject = "Your InternSmart Password Reset Code";
  const text = `
InternSmart - Password Reset

Hello ${name},

Your password reset code is: ${code}

This code expires in ${expiresInMinutes} minutes. If you did not request a password reset you can ignore this email - your password has not been changed.
  `;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2c3e50;">Password Reset</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Use the code below to reset your InternSmart password:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: bold; background: #f4f4f4; padding: 12px 16px; border-radius: 8px; display: inline-block;">${code}</p>
      <p>This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
      <p style="color: #e74c3c;">If you did not request a password reset you can ignore this email - your password has not been changed.</p>
    </div>
  `;

  return transporter.sendMail({ from: EMAIL_FROM, to, subject, text, html });
};

export default sendAccountEmail;