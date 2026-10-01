import { Op, fn, literal } from "sequelize";
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import DefenseAlert from "../models/defenseAlertModel.js";
import Task from "../models/taskModel.js";
import ReportComment from "../models/reportCommentModel.js";
import bcrypt from "bcrypt";
import generateTemporaryPassword from "../utils/generatePassword.js";
import { normalizeAcademicYear } from "../utils/academicYear.js";
import { validateDocumentContent } from "../utils/fileContent.js";
import sendAccountEmail, { sendDefenseAlertEmail } from "../utils/sendEmail.js";
import {
  assignSupervisorToStudent,
  findOrCreateSupervisor,
  notifySupervisorAssignment,
  SupervisorProvisioningError,
} from "../services/supervisorProvisioning.js";

const generateJitsiLink = (meetingId, title) => {
  const slug = `${title || "meeting"}-${meetingId}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://meet.jit.si/${slug}`;
};

// GET /api/admin/dashboard
//
// These eight counters are independent of one another, but each `count()` is a
// separate round-trip to MariaDB and they were issued one after another with
// `await`. That costs the *sum* of eight round-trips in wall-clock time and -
// what actually matters under load - holds one pooled connection for that whole
// duration. With the default pool of five, that serialisation is what caps
// throughput: measured with scripts/benchmarkEndpoints.js, this endpoint answered
// in ~16 ms when requests arrived one at a time, yet a 100-request concurrent
// burst managed only ~75 req/s. Raising the pool from 5 to 25 changed nothing,
// which is what pointed here rather than at connection capacity.
//
// Two changes, both semantics-preserving. The three report counters collapse into
// one statement using conditional aggregation, so three round-trips become one.
// What remains is issued concurrently, so a request occupies its connection for
// roughly the slowest single query instead of the sum of all six. The response
// shape is unchanged down to the key names and value types.
export const getDashboardStats = async (req, res) => {
  try {
    const [totalStudents, totalSupervisors, totalInternships, reportCounts, upcomingMeetings, defenseAlerts] =
      await Promise.all([
        Student.count({
          include: [{ model: User, as: "user", where: { email: { [Op.notLike]: "%.invalid" } } }],
        }),
        User.count({
          where: {
            role: "academic_supervisor",
          },
        }),
        Internship.count({
          include: [
            {
              model: Student,
              as: "student",
              required: true,
              include: [{ model: User, as: "user", where: { email: { [Op.notLike]: "%.invalid" } } }],
            },
          ],
        }),
        Report.findOne({
          attributes: [
            [
              fn("SUM", literal("CASE WHEN status IN ('submitted','in_review','ai_analysis') THEN 1 ELSE 0 END")),
              "pending",
            ],
            [fn("SUM", literal("CASE WHEN status = 'approved' THEN 1 ELSE 0 END")), "approved"],
            [fn("SUM", literal("CASE WHEN status = 'needs_revision' THEN 1 ELSE 0 END")), "needsRevision"],
          ],
          raw: true,
        }),
        Meeting.count({
          where: {
            status: "scheduled",
            date: { [Op.gte]: new Date() },
          },
        }),
        DefenseAlert.count({
          where: { status: "pending" },
        }),
      ]);

    // SUM over zero rows returns NULL, not 0, and MariaDB may return aggregates as
    // strings. Both would have been impossible with `count()`, which always yields
    // a number, so normalise rather than letting `null` reach the dashboard.
    const asCount = (value) => Number(value) || 0;

    return res.status(200).json({
      totalStudents,
      totalSupervisors,
      totalInternships,
      reportsPendingReview: asCount(reportCounts?.pending),
      reportsApproved: asCount(reportCounts?.approved),
      reportsNeedingRevision: asCount(reportCounts?.needsRevision),
      upcomingMeetings,
      defenseAlerts,
    });
  } catch (error) {
    console.error("DASHBOARD STATS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching dashboard stats",
      error: error.message,
    });
  }
};

// GET /api/admin/chart-data
export const getChartData = async (req, res) => {
  try {
    const { metric = "reports", range = "30d" } = req.query;

    let startDate = new Date();
    if (range === "7d") startDate.setDate(startDate.getDate() - 7);
    else if (range === "30d") startDate.setDate(startDate.getDate() - 30);
    else if (range === "semester") startDate.setMonth(startDate.getMonth() - 5);
    else if (range === "today") startDate.setHours(0, 0, 0, 0);
    else startDate.setDate(startDate.getDate() - 30);

    const formattedDate = startDate.toISOString().slice(0, 19).replace("T", " ");

    if (metric === "reports") {
      const rows = await sequelize.query(
        `SELECT DATE(submittedAt) as date, COUNT(id) as count 
         FROM Reports 
         WHERE submittedAt >= :startDate 
         GROUP BY DATE(submittedAt) 
         ORDER BY DATE(submittedAt) ASC`,
        { replacements: { startDate: formattedDate }, type: "SELECT" }
      );
      return res.status(200).json({ metric: "reports", data: rows });
    }

    if (metric === "internships") {
      const rows = await sequelize.query(
        `SELECT DATE(i.createdAt) as date, COUNT(i.id) as count 
         FROM Internships i
         JOIN Students s ON i.studentId = s.id
         JOIN Users u ON s.userId = u.id
         WHERE i.createdAt >= :startDate AND u.email NOT LIKE '%.invalid'
         GROUP BY DATE(i.createdAt) 
         ORDER BY DATE(i.createdAt) ASC`,
        { replacements: { startDate: formattedDate }, type: "SELECT" }
      );
      return res.status(200).json({ metric: "internships", data: rows });
    }

    if (metric === "users") {
      const rows = await sequelize.query(
        `SELECT DATE(createdAt) as date, COUNT(id) as count 
         FROM Users 
         WHERE createdAt >= :startDate AND email NOT LIKE '%.invalid'
         GROUP BY DATE(createdAt) 
         ORDER BY DATE(createdAt) ASC`,
        { replacements: { startDate: formattedDate }, type: "SELECT" }
      );
      return res.status(200).json({ metric: "users", data: rows });
    }

    if (metric === "ai") {
      const rows = await sequelize.query(
        `SELECT DATE(submittedAt) as date, AVG(aiScore) as avgScore 
         FROM Reports 
         WHERE submittedAt >= :startDate AND aiScore IS NOT NULL 
         GROUP BY DATE(submittedAt) 
         ORDER BY DATE(submittedAt) ASC`,
        { replacements: { startDate: formattedDate }, type: "SELECT" }
      );
      return res.status(200).json({ metric: "ai", data: rows });
    }

    return res.status(200).json({ metric, data: [] });
  } catch (error) {
    console.error("CHART DATA ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching chart data",
      error: error.message,
    });
  }
};

// GET /api/admin/users
export const getAllUsers = async (req, res) => {
  try {
    const { search = "", role = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      email: { [Op.notLike]: "%.invalid" },
    };
    if (search) {
      where[Op.and] = [
        {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
          ],
        },
      ];
    }
    if (role) {
      where.role = role;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Student,
          as: "student",
          include: [
            {
              model: Internship,
              as: "internship",
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      users,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching users",
      error: error.message,
    });
  }
};

// GET /api/admin/users/:id
export const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Student,
          as: "student",
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("GET USER DETAIL ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching user",
      error: error.message,
    });
  }
};

// PUT /api/admin/users/:id
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, matricule, class: studentClass, academicSupervisorId, professionalSupervisorId, company, academicYear, program, internshipDomain } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    await user.update({
      name: name || user.name,
      email: email || user.email,
      role: role || user.role,
    });

    if (user.role === "student") {
      const student = await Student.findOne({ where: { userId: user.id } });
      if (student) {
        await student.update({
          matricule: matricule !== undefined ? matricule : student.matricule,
          class: studentClass !== undefined ? studentClass : student.class,
        });

        let internship = await Internship.findOne({ where: { studentId: student.id } });
        if (!internship) {
          internship = await Internship.create({
            studentId: student.id,
            academicSupervisorId: academicSupervisorId || null,
            professionalSupervisorId: professionalSupervisorId || null,
            company: company || null,
            // The cohort a library entry is filed under. Normalised so "2025-2026"
            // and "2025/2026" cannot both end up stored.
            academicYear: normalizeAcademicYear(academicYear),
            program: program || null,
            internshipDomain: internshipDomain || null,
          });
        } else {
          await internship.update({
            academicSupervisorId: academicSupervisorId !== undefined ? academicSupervisorId : internship.academicSupervisorId,
            professionalSupervisorId: professionalSupervisorId !== undefined ? professionalSupervisorId : internship.professionalSupervisorId,
            company: company !== undefined ? company : internship.company,
            academicYear: academicYear !== undefined ? normalizeAcademicYear(academicYear) : internship.academicYear,
            program: program !== undefined ? program : internship.program,
            internshipDomain: internshipDomain !== undefined ? internshipDomain : internship.internshipDomain,
          });
        }
      }
    }

    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Student,
          as: "student",
          include: [{ model: Internship, as: "internship" }],
        },
      ],
    });

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating user",
      error: error.message,
    });
  }
};

// DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.active) {
      return res.status(400).json({
        message: "User must be deactivated before deletion. Please deactivate the user first.",
      });
    }

    // All cleanup runs in a single transaction. Previously each statement
    // committed independently, so a failure part-way through left the earlier
    // deletes committed - i.e. orphaned records (NFR-REL-02/03).
    await sequelize.transaction(async (t) => {
      // 1. If user is a student (or has a Student record)
      const student = await Student.findOne({ where: { userId: user.id }, transaction: t });
      if (student) {
        const reports = await Report.findAll({ where: { studentId: student.id }, transaction: t });
        for (const r of reports) {
          await ReportComment.destroy({ where: { reportId: r.id }, transaction: t });
        }
        await Report.destroy({ where: { studentId: student.id }, transaction: t });
        await Internship.destroy({ where: { studentId: student.id }, transaction: t });
        await Meeting.destroy({ where: { studentId: student.id }, transaction: t });
        await Task.destroy({ where: { studentId: student.id }, transaction: t });
        await DefenseAlert.destroy({ where: { studentId: student.id }, transaction: t });
        await student.destroy({ transaction: t });

        // Clean up group meetings where the student is listed in the studentIds
        // array. MariaDB implements JSON as LONGTEXT, so Sequelize can hand this
        // column back as a raw string (e.g. "[1]") instead of an array - the
        // previous Array.isArray() check was therefore always false and every
        // group meeting kept a dangling student reference.
        const groupMeetings = await Meeting.findAll({ where: { isGroupMeeting: true }, transaction: t });
        for (const m of groupMeetings) {
          let ids = m.studentIds;
          if (typeof ids === "string") {
            try {
              ids = JSON.parse(ids);
            } catch {
              ids = [];
            }
          }
          if (!Array.isArray(ids)) continue;

          const numericIds = ids.map(Number);
          const targetId = Number(student.id);
          if (!numericIds.includes(targetId)) continue;

          const updatedIds = numericIds.filter(sid => sid !== targetId);
          if (updatedIds.length === 0) {
            await m.destroy({ transaction: t });
          } else {
            await m.update({ studentIds: updatedIds }, { transaction: t });
          }
        }
      }

      // 2. If user is a supervisor (academic or professional)
      await Internship.update(
        { academicSupervisorId: null },
        { where: { academicSupervisorId: user.id }, transaction: t }
      );
      await Internship.update(
        { professionalSupervisorId: null },
        { where: { professionalSupervisorId: user.id }, transaction: t }
      );

      // 2b. Clear integer "who did it" traceability columns. These are FK-shaped
      // references to Users and were previously left dangling after a deletion.
      await Task.update({ feedbackAcademicBy: null }, { where: { feedbackAcademicBy: user.id }, transaction: t });
      await Task.update({ feedbackProfessionalBy: null }, { where: { feedbackProfessionalBy: user.id }, transaction: t });
      await Internship.update({ academicGradeSubmittedBy: null }, { where: { academicGradeSubmittedBy: user.id }, transaction: t });
      await Internship.update({ professionalGradeSubmittedBy: null }, { where: { professionalGradeSubmittedBy: user.id }, transaction: t });

      await Meeting.destroy({ where: { createdBy: user.id }, transaction: t });
      await Task.destroy({ where: { supervisorId: user.id }, transaction: t });

      // 3. Delete user's notifications and report comments
      await Notification.destroy({ where: { userId: user.id }, transaction: t });
      await ReportComment.destroy({ where: { userId: user.id }, transaction: t });

      // 4. Finally destroy the User record
      await user.destroy({ transaction: t });
    });

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    return res.status(500).json({
      message: "Server error while deleting user",
      error: error.message,
    });
  }
};

// PUT /api/admin/users/:id/status
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newActive = !user.active;
    const updateData = { active: newActive }

    if (newActive) {
      updateData.status = "logged_out"
      updateData.deactivatedAt = null
    } else {
      updateData.status = "deactivated"
      updateData.deactivatedAt = new Date()
    }

    await user.update(updateData)

    return res.status(200).json({
      message: `User ${newActive ? 'activated' : 'deactivated'} successfully`,
      user: { id: user.id, active: user.active, status: updateData.status, deactivatedAt: updateData.deactivatedAt },
    });
  } catch (error) {
    console.error("TOGGLE USER STATUS ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating user status",
      error: error.message,
    });
  }
};

// PUT /api/admin/users/:id/reset-password
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({
      password: hashedPassword,
      mustChangePassword: true,
    });

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Server error while resetting password",
      error: error.message,
    });
  }
};

// POST /api/admin/import/csv
export const importCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No CSV file uploaded" });
    }

    const fs = await import("fs");

    // Content check, after multer has the bytes. The filter on the route stops an
    // honest client picking the wrong file; this stops a renamed one. The temp
    // file is removed either way, so a rejected upload leaves nothing behind.
    const csvBuffer = fs.readFileSync(req.file.path);
    const verdict = validateDocumentContent(csvBuffer, "csv");
    if (!verdict.ok) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: verdict.reason });
    }

    const csvContent = csvBuffer.toString("utf-8").replace(/^\uFEFF/, "");
    const lines = csvContent.split("\n").filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ message: "CSV file is empty or invalid" });
    }

    const HEADER_MAP = {
      "student_name": "student_name",
      "studentname": "student_name",
      "student name": "student_name",
      "name": "student_name",
      "full_name": "student_name",
      "fullname": "student_name",
      "student_email": "student_email",
      "studentemail": "student_email",
      "student email": "student_email",
      "email": "student_email",
      "student_matricule": "student_matricule",
      "studentmatricule": "student_matricule",
      "student matricule": "student_matricule",
      "matricule": "student_matricule",
      "student_id": "student_matricule",
      "class": "class",
      "student_class": "class",
      "student class": "class",
      "academic_supervisor_name": "academic_supervisor_name",
      "academicsupervisorname": "academic_supervisor_name",
      "academic supervisor name": "academic_supervisor_name",
      "supervisor_name": "academic_supervisor_name",
      "supervisor name": "academic_supervisor_name",
      "academic_supervisor_email": "academic_supervisor_email",
      "academicsupervisoremail": "academic_supervisor_email",
      "academic supervisor email": "academic_supervisor_email",
      "supervisor_email": "academic_supervisor_email",
      "supervisor email": "academic_supervisor_email",
      "professional_supervisor_name": "professional_supervisor_name",
      "professionalsupervisorname": "professional_supervisor_name",
      "professional supervisor name": "professional_supervisor_name",
      "professional_supervisor_email": "professional_supervisor_email",
      "professionalsupervisoremail": "professional_supervisor_email",
      "professional supervisor email": "professional_supervisor_email",
    };

    // Detect CSV delimiter (comma, semicolon, or tab) to handle Excel exports across all OS locales
    const detectDelimiter = (line) => {
      const commas = (line.match(/,/g) || []).length;
      const semicolons = (line.match(/;/g) || []).length;
      const tabs = (line.match(/\t/g) || []).length;
      if (semicolons > commas && semicolons > tabs) return ";";
      if (tabs > commas && tabs > semicolons) return "\t";
      return ",";
    };

    const delimiter = detectDelimiter(lines[0]);

    // Quote-aware CSV line parser
    const parseCsvLine = (line, delim) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ""));
      return result;
    };

    const rawHeaders = parseCsvLine(lines[0], delimiter).map(h => h.toLowerCase());
    const headers = rawHeaders.map(h => HEADER_MAP[h] || h);

    const requiredHeaders = [
      "student_name",
      "student_email",
      "student_matricule",
      "class",
      "academic_supervisor_name",
      "academic_supervisor_email",
    ];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        message: `Missing required column headers: ${missingHeaders.join(", ")}.`,
        missing: missingHeaders,
      });
    }

    const results = {
      success: 0,
      errors: [],
      warnings: [],
    };

    // Resolved supervisors are memoised for the whole import, so one person is
    // looked up - and emailed - once however many rows reference them. Entries
    // hold the whole result object rather than a bare id so the created/reused
    // distinction, and therefore which email is due, survives to later rows.
    const supervisorCache = new Map();

    const resolveSupervisor = async ({ email, name, role, rowNumber, transaction }) => {
      if (!email?.trim()) return null;

      const key = `${role}:${email.trim().toLowerCase()}`;
      if (supervisorCache.has(key)) return supervisorCache.get(key);

      const resolved = await findOrCreateSupervisor({ email, name, role, transaction });
      supervisorCache.set(key, resolved);

      if (resolved.created) {
        results.warnings.push({
          row: rowNumber,
          warning: `Created ${role === "academic_supervisor" ? "academic" : "professional"} supervisor account for ${resolved.user.email}`,
        });
      }

      return resolved;
    };

    // Notifies each supervisor at most once per import, and only after the row's
    // transaction commits. The previous implementation sent mail *inside* the
    // transaction, so a rollback could still deliver credentials for a row that
    // was never persisted.
    const notifyResolvedSupervisor = async ({
      resolved,
      role,
      studentName,
      studentEmail,
      company,
      rowNumber,
    }) => {
      if (!resolved || resolved.notified) return;
      resolved.notified = true;

      const outcome = await notifySupervisorAssignment({
        supervisor: resolved.user,
        created: resolved.created,
        temporaryPassword: resolved.temporaryPassword,
        role,
        studentName,
        studentEmail,
        company,
      });

      if (outcome.warning) {
        results.warnings.push({ row: rowNumber, warning: outcome.warning });
      }
    };

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i], delimiter);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      // Each row is imported inside its own transaction: it either creates
      // User + Student (+ Internship) completely, or leaves nothing behind.
      // An unmanaged transaction is used so the surrounding loop flow is kept.
      let t = null;
      try {
        t = await sequelize.transaction();

        const existingUser = await User.findOne({ where: { email: row.student_email }, transaction: t });
        if (existingUser) {
          results.errors.push({ row: i + 1, error: `Email ${row.student_email} already exists` });
          await t.rollback();
          t = null;
          continue;
        }

        const existingMatricule = await Student.findOne({ where: { matricule: row.student_matricule }, transaction: t });
        if (existingMatricule) {
          results.errors.push({ row: i + 1, error: `Matricule ${row.student_matricule} already exists` });
          await t.rollback();
          t = null;
          continue;
        }

        const academicSupervisor = await resolveSupervisor({
          email: row.academic_supervisor_email,
          name: row.academic_supervisor_name,
          role: "academic_supervisor",
          rowNumber: i + 1,
          transaction: t,
        });

        const professionalSupervisor = row.professional_supervisor_email
          ? await resolveSupervisor({
              email: row.professional_supervisor_email,
              name: row.professional_supervisor_name,
              role: "professional_supervisor",
              rowNumber: i + 1,
              transaction: t,
            })
          : null;

        const temporaryPassword = generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        const user = await User.create({
          name: row.student_name,
          email: row.student_email,
          password: hashedPassword,
          role: "student",
          mustChangePassword: true,
          active: true,
        }, { transaction: t });

        const student = await Student.create({
          userId: user.id,
          matricule: row.student_matricule,
          class: row.class,
        }, { transaction: t });

        // NOTE: the "already assigned to supervisor" checks that previously sat
        // here looked up Internship by the id of the Student row created directly
        // above, so they could never match. Their `continue` skipped the commit
        // and abandoned the freshly created User + Student as orphans. Duplicate
        // students are already rejected by the email/matricule checks above.

        if (academicSupervisor || professionalSupervisor) {
          await Internship.create({
            studentId: student.id,
            academicSupervisorId: academicSupervisor?.user.id ?? null,
            professionalSupervisorId: professionalSupervisor?.user.id ?? null,
            company: row.company || null,
          }, { transaction: t });
        }

        await t.commit();
        t = null;

        results.success++;

        // Mail is sent only now that the row is durable. Failures here are
        // warnings rather than row errors - the data is already committed, so
        // reporting the row as failed would be untrue and would invite a
        // duplicate re-import.
        try {
          await sendAccountEmail({
            to: row.student_email,
            name: row.student_name,
            password: temporaryPassword,
            role: "student",
          });
        } catch (emailError) {
          results.warnings.push({
            row: i + 1,
            warning: `Student account created but the welcome email failed for ${row.student_email}: ${emailError.message}`,
          });
        }

        try {
          await notifyResolvedSupervisor({
            resolved: academicSupervisor,
            role: "academic_supervisor",
            studentName: row.student_name,
            studentEmail: row.student_email,
            company: row.company || null,
            rowNumber: i + 1,
          });

          await notifyResolvedSupervisor({
            resolved: professionalSupervisor,
            role: "professional_supervisor",
            studentName: row.student_name,
            studentEmail: row.student_email,
            company: row.company || null,
            rowNumber: i + 1,
          });
        } catch (notificationError) {
          results.warnings.push({
            row: i + 1,
            warning: `Student imported but supervisor notification failed: ${notificationError.message}`,
          });
        }
      } catch (error) {
        if (t) {
          try {
            await t.rollback();
          } catch (rollbackError) {
            console.error("CSV IMPORT ROLLBACK ERROR:", rollbackError.message);
          }
          t = null;
          // The cache may hold supervisor ids written by the rolled-back row.
          supervisorCache.clear();
        }
        results.errors.push({ row: i + 1, error: error.message });
      }
    }

    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      message: "Import completed",
      results,
    });
  } catch (error) {
    console.error("CSV IMPORT ERROR:", error);
    return res.status(500).json({
      message: "Server error during CSV import",
      error: error.message,
    });
  }
};

// POST /api/admin/users
//
// Creating a student optionally assigns their academic supervisor in the same
// step, which is the documented workflow: the admin picks the supervisor, the
// supervisor's account is reused if the email already exists or created (with
// emailed credentials) if it does not.
export const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      matricule,
      class: studentClass,
      academicSupervisorEmail,
      academicSupervisorName,
      company,
    } = req.body;

    if (!name?.trim() || !email?.trim() || !role) {
      return res.status(400).json({ message: "Name, email, and role are required" });
    }

    if (academicSupervisorEmail && role !== "student") {
      return res.status(400).json({
        message: "An academic supervisor can only be assigned while creating a student account",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists. Use reset password if delivery failed." });
    }

    // Crypto-based rather than Math.random(): this password is the only thing
    // protecting a brand-new account, and generatePassword.js exists for exactly
    // this purpose but was previously imported and never called.
    const temporaryPassword = generateTemporaryPassword();

    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    let createdUser;
    let supervisorResult = null;

    // User + Student + Internship + supervisor account are one unit of work: if
    // the requested supervisor cannot be resolved, the student must not be left
    // behind half-created without the assignment that was asked for.
    await sequelize.transaction(async (t) => {
      createdUser = await User.create(
        {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role,
          mustChangePassword: true,
          active: true,
          status: "logged_out",
        },
        { transaction: t }
      );

      if (role === "student") {
        const student = await Student.create(
          {
            userId: createdUser.id,
            matricule: matricule || `TEMP-${createdUser.id}`,
            class: studentClass || "Pending Assignment",
          },
          { transaction: t }
        );

        if (academicSupervisorEmail) {
          supervisorResult = await assignSupervisorToStudent({
            studentId: student.id,
            studentName: name.trim(),
            studentEmail: normalizedEmail,
            role: "academic_supervisor",
            email: academicSupervisorEmail,
            name: academicSupervisorName,
            company: company?.trim() ? company.trim() : undefined,
            transaction: t,
          });
        }
      }
    });

    let emailSent = true;
    if (role === "student" || role === "academic_supervisor" || role === "professional_supervisor") {
      try {
        await sendAccountEmail({
          to: normalizedEmail,
          name: name.trim(),
          password: temporaryPassword,
          role,
        });
      } catch (emailError) {
        emailSent = false;
        console.error("CREATE USER EMAIL ERROR:", emailError);
      }
    }

    // Sent only after the transaction committed - mailing credentials for a row a
    // rollback could still erase would be worse than a late email.
    let supervisorNotification = null;
    if (supervisorResult) {
      supervisorNotification = await notifySupervisorAssignment({
        supervisor: supervisorResult.supervisor,
        created: supervisorResult.created,
        temporaryPassword: supervisorResult.temporaryPassword,
        role: "academic_supervisor",
        studentName: name.trim(),
        studentEmail: normalizedEmail,
        company: company?.trim() || null,
      });
    }

    return res.status(201).json({
      message: emailSent ? "User created and account email sent" : "User created, but the account email could not be sent",
      emailSent,
      user: { id: createdUser.id, name: createdUser.name, email: createdUser.email, role: createdUser.role },
      academicSupervisor: supervisorResult
        ? {
            id: supervisorResult.supervisor.id,
            name: supervisorResult.supervisor.name,
            email: supervisorResult.supervisor.email,
            accountCreated: supervisorResult.created,
          }
        : null,
      supervisorNotification,
    });
  } catch (error) {
    if (error instanceof SupervisorProvisioningError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error("CREATE USER ERROR:", error);
    return res.status(500).json({
      message: "Server error while creating user",
      error: error.message,
    });
  }
};

export const resendUserAccountEmail = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(400).json({ message: "Account email is not available for admin users" });

    const temporaryPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
    user.password = await bcrypt.hash(temporaryPassword, 10);
    user.mustChangePassword = true;
    await user.save();
    await sendAccountEmail({ to: user.email, name: user.name, password: temporaryPassword, role: user.role });

    return res.status(200).json({ message: "Account email sent successfully", emailSent: true });
  } catch (error) {
    console.error("RESEND USER EMAIL ERROR:", error);
    return res.status(500).json({ message: "Password was updated, but the account email could not be sent", emailSent: false });
  }
};

// GET /api/admin/students
export const getAllStudents = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where[Op.or] = [
        { matricule: { [Op.like]: `%${search}%` } },
        { class: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: students } = await Student.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          where: { email: { [Op.notLike]: "%.invalid" } },
          attributes: ["id", "name", "email", "role"],
          required: true,
        },
        {
          model: Internship,
          as: "internship",
          include: [
            {
              model: User,
              as: "academicSupervisor",
              attributes: ["id", "name", "email"],
            },
            {
              model: User,
              as: "professionalSupervisor",
              attributes: ["id", "name", "email"],
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      students,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("GET STUDENTS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching students",
      error: error.message,
    });
  }
};

// GET /api/admin/supervisors
export const getAllSupervisors = async (req, res) => {
  try {
    const { search = "", role = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      [Op.or]: [
        { role: "academic_supervisor" },
        { role: "professional_supervisor" },
      ],
    };
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const { count, rows: supervisors } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password"] },
      limit: parseInt(limit),
      offset,
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      supervisors,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("GET SUPERVISORS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching supervisors",
      error: error.message,
    });
  }
};

// GET /api/admin/internships
export const getAllInternships = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where[Op.or] = [
        { "$student.user.name$": { [Op.like]: `%${search}%` } },
        { "$student.user.email$": { [Op.like]: `%${search}%` } },
        { "$academicSupervisor.name$": { [Op.like]: `%${search}%` } },
        { "$professionalSupervisor.name$": { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: rawInternships } = await Internship.findAndCountAll({
      where,
      include: [
        {
          model: Student,
          as: "student",
          required: true,
          include: [
            {
              model: User,
              as: "user",
              where: { email: { [Op.notLike]: "%.invalid" } },
              attributes: ["id", "name", "email"],
              required: true,
            },
            {
              model: Report,
              as: "reports",
              attributes: ["id", "status", "submittedAt", "finalSubmittedAt", "updatedAt"],
            },
          ],
        },
        {
          model: User,
          as: "academicSupervisor",
          attributes: ["id", "name", "email"],
        },
        {
          model: User,
          as: "professionalSupervisor",
          attributes: ["id", "name", "email"],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["id", "DESC"]],
    });

    const internships = rawInternships.map((item) => {
      const plain = item.get({ plain: true });
      const reports = plain.student?.reports || [];
      reports.sort((a, b) => b.id - a.id);
      const latest = reports[0];

      let percent = 0;
      let stage = "Not Started";
      let statusKey = "not_started";

      if (latest) {
        if (latest.status === "final_submitted" || latest.status === "approved") {
          percent = 100;
          stage = "Final Submitted";
          statusKey = "completed";
        } else if (latest.status === "needs_revision") {
          percent = 75;
          stage = "Needs Revision";
          statusKey = "revision";
        } else if (["submitted", "in_review", "ai_analysis"].includes(latest.status)) {
          percent = 60;
          stage = "Under Review";
          statusKey = "in_review";
        } else if (latest.status === "draft") {
          percent = 35;
          stage = "Report Drafting";
          statusKey = "draft";
        }
      }

      return {
        ...plain,
        progress: {
          percent,
          stage,
          statusKey,
          reportCount: reports.length,
          latestReportStatus: latest?.status || null,
          lastActivity: latest?.updatedAt || latest?.submittedAt || null,
        },
      };
    });

    return res.status(200).json({
      internships,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("GET INTERNSHIPS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching internships",
      error: error.message,
    });
  }
};

// GET /api/admin/reports
export const getAllReports = async (req, res) => {
  try {
    const { search = "", status = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { fileName: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const { count, rows: reports } = await Report.findAndCountAll({
      where,
      attributes: [
        "id",
        "studentId",
        "title",
        "fileName",
        "fileUrl",
        "version",
        "status",
        "progress",
        "aiScore",
        "aiAnalysis",
        "submittedAt",
        "updatedAt",
        "currentVersionId",
        "reviewCycle",
        "submissionRequestedAt",
        "finalSubmittedAt",
        "lockedAt",
      ],
      include: [
        {
          model: Student,
          as: "student",
          required: true,
          include: [
            {
              model: User,
              as: "user",
              where: { email: { [Op.notLike]: "%.invalid" } },
              attributes: ["id", "name", "email"],
              required: true,
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      reports,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("GET REPORTS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching reports",
      error: error.message,
    });
  }
};

// PUT /api/admin/reports/:id
export const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, aiScore, aiAnalysis } = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    await report.update({
      status: status || report.status,
      aiScore: aiScore !== undefined ? aiScore : report.aiScore,
      aiAnalysis: aiAnalysis !== undefined ? aiAnalysis : report.aiAnalysis,
    });

    return res.status(200).json({
      message: "Report updated successfully",
      report,
    });
  } catch (error) {
    console.error("UPDATE REPORT ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating report",
      error: error.message,
    });
  }
};

// GET /api/admin/meetings
export const getAllMeetings = async (req, res) => {
  try {
    const { search = "", status = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }
    if (status) {
      where.status = status;
    }

    const { count, rows: meetings } = await Meeting.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "email"],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["date", "DESC"]],
    });

    return res.status(200).json({
      meetings,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("GET MEETINGS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching meetings",
      error: error.message,
    });
  }
};

// POST /api/admin/meetings
export const createMeeting = async (req, res) => {
  try {
    const { title, description, date, location, meetingLink, createdBy } = req.body;

    const jitsiLink = meetingLink?.startsWith("https://meet.jit.si/")
      ? meetingLink
      : generateJitsiLink(createdBy || req.user?.id || 1, title);

    const meeting = await Meeting.create({
      title,
      description,
      date,
      location,
      meetingLink: jitsiLink,
      createdBy: createdBy || req.user?.id || 1,
    });

    return res.status(201).json({
      message: "Meeting created successfully",
      meeting,
    });
  } catch (error) {
    console.error("CREATE MEETING ERROR:", error);
    return res.status(500).json({
      message: "Server error while creating meeting",
      error: error.message,
    });
  }
};

// PUT /api/admin/meetings/:id
export const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date, location, meetingLink, status } = req.body;

    const meeting = await Meeting.findByPk(id);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    await meeting.update({
      title: title || meeting.title,
      description: description !== undefined ? description : meeting.description,
      date: date || meeting.date,
      location: location !== undefined ? location : meeting.location,
      meetingLink: meetingLink !== undefined
        ? (meetingLink.startsWith("https://meet.jit.si/")
          ? meetingLink
          : generateJitsiLink(`admin-${req.user?.id || 1}-${id}`, title || meeting.title))
        : meeting.meetingLink,
      status: status || meeting.status,
    });

    return res.status(200).json({
      message: "Meeting updated successfully",
      meeting,
    });
  } catch (error) {
    console.error("UPDATE MEETING ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating meeting",
      error: error.message,
    });
  }
};

// DELETE /api/admin/meetings/:id
export const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findByPk(id);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    await meeting.destroy();
    return res.status(200).json({ message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("DELETE MEETING ERROR:", error);
    return res.status(500).json({
      message: "Server error while deleting meeting",
      error: error.message,
    });
  }
};

// GET /api/admin/notifications
export const getAllNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: notifications } = await Notification.findAndCountAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      notifications,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching notifications",
      error: error.message,
    });
  }
};

// POST /api/admin/notifications
export const createNotification = async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;

    const notification = await Notification.create({
      userId,
      title,
      message,
      type: type || "info",
    });

    return res.status(201).json({
      message: "Notification created successfully",
      notification,
    });
  } catch (error) {
    console.error("CREATE NOTIFICATION ERROR:", error);
    return res.status(500).json({
      message: "Server error while creating notification",
      error: error.message,
    });
  }
};

// GET /api/admin/defense-alerts
export const getAllDefenseAlerts = async (req, res) => {
  try {
    const { search = "", status = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }
    if (status) {
      where.status = status;
    }

    const { count, rows: alerts } = await DefenseAlert.findAndCountAll({
      where,
      include: [
        {
          model: Student,
          as: "student",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "email"],
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      alerts,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error("GET DEFENSE ALERTS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching defense alerts",
      error: error.message,
    });
  }
};

// POST /api/admin/defense-alerts
export const createDefenseAlert = async (req, res) => {
  try {
    const { studentId, title, message, defenseDate } = req.body;

    if (!studentId || !title?.trim() || !message?.trim()) {
      return res.status(400).json({ message: "Student, title, and message are required" });
    }

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const alert = await DefenseAlert.create({
      studentId,
      title: title.trim(),
      message: message.trim(),
      defenseDate,
      status: "scheduled",
    });

    await Notification.create({
      userId: student.userId,
      title: title.trim(),
      message: `${message.trim()}${defenseDate ? ` Defense date: ${new Date(defenseDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.` : ""}`,
      type: "warning",
    });

    try {
      const studentUser = await User.findByPk(student.userId, { attributes: ["name", "email"] });
      if (studentUser?.email) {
        await sendDefenseAlertEmail({
          to: studentUser.email,
          name: studentUser.name,
          title: title.trim(),
          message: message.trim(),
          defenseDate,
        });
      }
    } catch (emailError) {
      console.warn("DEFENSE ALERT EMAIL ERROR:", emailError.message);
    }

    return res.status(201).json({
      message: "Defense alert created successfully",
      alert,
    });
  } catch (error) {
    console.error("CREATE DEFENSE ALERT ERROR:", error);
    return res.status(500).json({
      message: "Server error while creating defense alert",
      error: error.message,
    });
  }
};

// PUT /api/admin/defense-alerts/:id
export const updateDefenseAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, defenseDate, status } = req.body;

    const alert = await DefenseAlert.findByPk(id);
    if (!alert) {
      return res.status(404).json({ message: "Defense alert not found" });
    }

    await alert.update({
      title: title || alert.title,
      message: message !== undefined ? message : alert.message,
      defenseDate: defenseDate !== undefined ? defenseDate : alert.defenseDate,
      status: status || alert.status,
    });

    return res.status(200).json({
      message: "Defense alert updated successfully",
      alert,
    });
  } catch (error) {
    console.error("UPDATE DEFENSE ALERT ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating defense alert",
      error: error.message,
    });
  }
};
