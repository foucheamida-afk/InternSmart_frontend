import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";

const BASE = "http://localhost:3000/api";
const TAG = `probe${Date.now()}`;
const PASSWORD = "VerifyPass123!";

const user = await User.create({ name: "Probe Student", email: `${TAG}@example.invalid`, password: await bcrypt.hash(PASSWORD, 10), role: "student", mustChangePassword: false, active: true });
const student = await Student.create({ userId: user.id, matricule: `M-${TAG}`, class: "Probe" });

const lr = await fetch(`${BASE}/users/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password: PASSWORD }) });
const ld = await lr.json();
console.log("login status:", lr.status);
console.log("login message:", ld.message, "| error:", ld.error);
console.log("token present:", Boolean(ld.token), "| prefix:", String(ld.token).slice(0, 12));

const dir = path.join(process.cwd(), "uploads");
const pdf = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith(".pdf"));
const form = new FormData();
form.append("title", "Probe Report");
form.append("report", new Blob([fs.readFileSync(path.join(dir, pdf))], { type: "application/pdf" }), "probe.pdf");
const ur = await fetch(`${BASE}/students/reports`, { method: "POST", headers: { Authorization: `Bearer ${ld.token}` }, body: form });
const ud = await ur.json();
console.log("upload status:", ur.status, "| body:", JSON.stringify(ud).slice(0, 200));

// cleanup
if (ud.report?.id) { const { default: Report } = await import("../models/reportModel.js"); const { default: RV } = await import("../models/reportVersionModel.js"); await RV.destroy({ where: { reportId: ud.report.id } }); await Report.destroy({ where: { id: ud.report.id } }); }
await Student.destroy({ where: { id: student.id } });
await User.destroy({ where: { id: user.id } });
console.log("probe cleaned up");
await sequelize.close();
