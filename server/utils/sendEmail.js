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

const sendAccountEmail = async ({ to, name, password, role }) => {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    throw new Error("Email service is not configured on the server.");
  }

  const subject = "Your InternSmart Account Has Been Created";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #2c3e50;">Welcome to InternSmart</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your ${role === "academic_supervisor" ? "Academic Supervisor" : role === "professional_supervisor" ? "Professional Supervisor" : "Student"} account has been created on InternSmart.</p>
      <p><strong>Email:</strong> ${to}</p>
      <p><strong>Temporary Password:</strong> <code style="background: #f4f4f4; padding: 4px 8px; border-radius: 4px;">${password}</code></p>
      <p style="color: #e74c3c;"><strong>Important:</strong> You are required to change this password upon your first login.</p>
      <p>Please log in at: <a href="http://localhost:5173" style="color: #3498db;">InternSmart Portal</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">If you did not expect this email, please contact your administrator.</p>
    </div>
  `;

  const text = `
Welcome to InternSmart

Hello ${name},

Your ${role === "academic_supervisor" ? "Academic Supervisor" : role === "professional_supervisor" ? "Professional Supervisor" : "Student"} account has been created on InternSmart.

Email: ${to}
Temporary Password: ${password}

Important: You are required to change this password upon your first login.

Please log in at: http://localhost:5173

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

export default sendAccountEmail;