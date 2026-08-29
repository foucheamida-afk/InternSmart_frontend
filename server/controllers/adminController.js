import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import DefenseAlert from "../models/defenseAlertModel.js";
import bcrypt from "bcrypt";
import generateTemporaryPassword from "../utils/generatePassword.js";

// GET /api/admin/dashboard
export const getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.count();
    const totalSupervisors = await User.count({
      where: {
        role: "academic_supervisor",
      },
    });
    const totalInternships = await Internship.count();
    const reportsPendingReview = await Report.count({
      where: { status: ["submitted", "in_review", "ai_analysis"] },
    });
    const reportsApproved = await Report.count({
      where: { status: "approved" },
    });
    const reportsNeedingRevision = await Report.count({
      where: { status: "needs_revision" },
    });
    const upcomingMeetings = await Meeting.count({
      where: {
        status: "scheduled",
        date: { [Op.gte]: new Date() },
      },
    });
    const defenseAlerts = await DefenseAlert.count({
      where: { status: "pending" },
    });

    return res.status(200).json({
      totalStudents,
      totalSupervisors,
      totalInternships,
      reportsPendingReview,
      reportsApproved,
      reportsNeedingRevision,
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
        `SELECT DATE(createdAt) as date, COUNT(id) as count 
         FROM Internships 
         WHERE createdAt >= :startDate 
         GROUP BY DATE(createdAt) 
         ORDER BY DATE(createdAt) ASC`,
        { replacements: { startDate: formattedDate }, type: "SELECT" }
      );
      return res.status(200).json({ metric: "internships", data: rows });
    }

    if (metric === "users") {
      const rows = await sequelize.query(
        `SELECT DATE(createdAt) as date, COUNT(id) as count 
         FROM Users 
         WHERE createdAt >= :startDate 
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

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ["password"] },
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
          as: "studentProfile",
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
    const { name, email, role } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.update({ name, email, role });

    return res.status(200).json({
      message: "User updated successfully",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
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

    await user.destroy();
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

    const newStatus = !user.active;
    await user.update({ active: newStatus });

    return res.status(200).json({
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      user: { id: user.id, active: user.active },
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
    const csvContent = fs.readFileSync(req.file.path, "utf-8");
    const lines = csvContent.split("\n").filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ message: "CSV file is empty or invalid" });
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
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
        message: "Missing required columns",
        missing: missingHeaders,
      });
    }

    const results = {
      success: 0,
      errors: [],
      warnings: [],
    };

    const supervisorCache = new Map();

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      try {
        const existingUser = await User.findOne({ where: { email: row.student_email } });
        if (existingUser) {
          results.errors.push({ row: i + 1, error: `Email ${row.student_email} already exists` });
          continue;
        }

        const existingMatricule = await Student.findOne({ where: { matricule: row.student_matricule } });
        if (existingMatricule) {
          results.errors.push({ row: i + 1, error: `Matricule ${row.student_matricule} already exists` });
          continue;
        }

        let academicSupervisorId = null;

        if (row.academic_supervisor_email) {
          if (supervisorCache.has(row.academic_supervisor_email)) {
            academicSupervisorId = supervisorCache.get(row.academic_supervisor_email);
          } else {
            let academicSupervisor = await User.findOne({
              where: { email: row.academic_supervisor_email, role: "academic_supervisor" },
            });

            if (!academicSupervisor) {
              const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
              const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

              academicSupervisor = await User.create({
                name: row.academic_supervisor_name || row.academic_supervisor_email,
                email: row.academic_supervisor_email,
                password: hashedTempPassword,
                role: "academic_supervisor",
                mustChangePassword: true,
                active: true,
              });

              results.warnings.push({
                row: i + 1,
                warning: `Created supervisor account for ${row.academic_supervisor_email}`,
              });
            }

            academicSupervisorId = academicSupervisor.id;
            supervisorCache.set(row.academic_supervisor_email, academicSupervisorId);
          }
        }

        const temporaryPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        const user = await User.create({
          name: row.student_name,
          email: row.student_email,
          password: hashedPassword,
          role: "student",
          mustChangePassword: true,
          active: true,
        });

        const student = await Student.create({
          userId: user.id,
          matricule: row.student_matricule,
          class: row.class,
        });

        if (academicSupervisorId) {
          await Internship.create({
            studentId: student.id,
            academicSupervisorId,
            company: null,
          });
        }

        results.success++;
      } catch (error) {
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
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, matricule, class: studentClass } = req.body;

    const existing = await User.findOne({ where: { email } });
    // if (existing) {
    //   return res.status(409).json({ message: "Email already exists" });
    // }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      mustChangePassword: true,
    });

    if (role === "student") {
      await Student.create({
        userId: user.id,
        matricule: matricule || `TEMP-${user.id}`,
        class: studentClass || "Pending Assignment",
      });
    }

    return res.status(201).json({
      message: "User created successfully",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);
    return res.status(500).json({
      message: "Server error while creating user",
      error: error.message,
    });
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
          attributes: ["id", "name", "email", "role"],
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

    const where = { role: "academic_supervisor" };
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
      ];
    }

    const { count, rows: internships } = await Internship.findAndCountAll({
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
        {
          model: User,
          as: "academicSupervisor",
          attributes: ["id", "name", "email"],
        },
      ],
      limit: parseInt(limit),
      offset,
      order: [["id", "DESC"]],
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

    const meeting = await Meeting.create({
      title,
      description,
      date,
      location,
      meetingLink,
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
      meetingLink: meetingLink !== undefined ? meetingLink : meeting.meetingLink,
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

    const alert = await DefenseAlert.create({
      studentId,
      title,
      message,
      defenseDate,
    });

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
