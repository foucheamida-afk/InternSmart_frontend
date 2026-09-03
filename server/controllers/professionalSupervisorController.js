import { Op } from "sequelize";
import Task from "../models/taskModel.js";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Report from "../models/reportModel.js";

// GET /api/professional-supervisor/my-interns
export const getMyInterns = async (req, res) => {
  try {
    const supervisorId = req.user.id;

    const internships = await Internship.findAll({
      where: { professionalSupervisorId: supervisorId },
      include: [
        {
          model: Student,
          as: "student",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "name", "email", "role"],
            },
          ],
        },
      ],
    });

    const interns = await Promise.all(internships.map(async (internship) => {
      const report = await Report.findOne({ where: { studentId: internship.studentId }, order: [["updatedAt", "DESC"], ["id", "DESC"]], attributes: ["id"] });
      return {
      id: internship.student?.id,
      userId: internship.student?.user?.id,
      name: internship.student?.user?.name,
      email: internship.student?.user?.email,
      matricule: internship.student?.matricule,
      class: internship.student?.class,
      company: internship.company,
      internshipId: internship.id,
      reportId: report?.id || null,
      };
    }));

    return res.status(200).json({ interns, total: interns.length });
  } catch (error) {
    console.error("GET PROFESSIONAL SUPERVISOR INTERNS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching interns",
      error: error.message,
    });
  }
};

// GET /api/professional-supervisor/tasks
export const getTasks = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { status, studentId, search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { supervisorId };

    if (status && status !== "all") {
      where.status = status;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    const include = [
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
    ];

    if (search) {
      include[0].where = {
        [Op.or]: [
          { "$user.name$": { [Op.like]: `%${search}%` } },
          { "$user.email$": { [Op.like]: `%${search}%` } },
        ],
      };
      include[0].required = true;
    }

    const { count, rows: tasks } = await Task.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset,
      order: [
        ["completed", "ASC"],
        ["dueDate", "ASC"],
        ["id", "DESC"],
      ],
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    return res.status(200).json({
      tasks,
      total: count,
      page: parseInt(page),
      totalPages,
    });
  } catch (error) {
    console.error("GET PROFESSIONAL SUPERVISOR TASKS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching tasks",
      error: error.message,
    });
  }
};

// POST /api/professional-supervisor/tasks
export const createTask = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { studentId, title, description, dueDate } = req.body;

    if (!studentId || !title) {
      return res.status(400).json({ message: "Student and title are required" });
    }

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const internship = await Internship.findOne({
      where: { studentId: student.id, professionalSupervisorId: supervisorId },
    });

    if (!internship) {
      return res.status(403).json({ message: "You are not assigned to this student" });
    }

    const task = await Task.create({
      studentId: student.id,
      supervisorId,
      title,
      description: description || "",
      dueDate: dueDate || null,
      status: "pending",
      completed: false,
      progress: 0,
    });

    const createdTask = await Task.findByPk(task.id, {
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
    });

    return res.status(201).json({
      message: "Task created successfully",
      task: createdTask,
    });
  } catch (error) {
    console.error("CREATE PROFESSIONAL SUPERVISOR TASK ERROR:", error);
    return res.status(500).json({
      message: "Server error while creating task",
      error: error.message,
    });
  }
};

// PUT /api/professional-supervisor/tasks/:id
export const updateTask = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;
    const { title, description, dueDate, status, progress } = req.body;

    const task = await Task.findOne({
      where: { id, supervisorId },
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
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "completed") {
        updateData.completed = true;
        updateData.progress = 100;
      } else {
        updateData.completed = false;
      }
    }
    if (progress !== undefined) {
      updateData.progress = Math.min(100, Math.max(0, parseInt(progress)));
      if (updateData.progress === 100) {
        updateData.status = "completed";
        updateData.completed = true;
      } else if (updateData.progress > 0) {
        updateData.status = "in_progress";
        updateData.completed = false;
      } else {
        updateData.status = "pending";
        updateData.completed = false;
      }
    }

    await task.update(updateData);

    return res.status(200).json({
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("UPDATE PROFESSIONAL SUPERVISOR TASK ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating task",
      error: error.message,
    });
  }
};

// DELETE /api/professional-supervisor/tasks/:id
export const deleteTask = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;

    const task = await Task.findOne({
      where: { id, supervisorId },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    await task.destroy();

    return res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("DELETE PROFESSIONAL SUPERVISOR TASK ERROR:", error);
    return res.status(500).json({
      message: "Server error while deleting task",
      error: error.message,
    });
  }
};

// PUT /api/professional-supervisor/tasks/:id/feedback
export const submitTaskFeedback = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ message: "Feedback text is required" });
    }

    const task = await Task.findOne({ where: { id, supervisorId } });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    await task.update({
      feedback: feedback.trim(),
      feedbackAt: new Date(),
      feedbackProfessional: feedback.trim(),
      feedbackProfessionalAt: new Date(),
      feedbackProfessionalBy: supervisorId,
    });

    return res.status(200).json({ message: "Feedback submitted", task });
  } catch (error) {
    console.error("SUBMIT PROFESSIONAL SUPERVISOR TASK FEEDBACK ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/professional-supervisor/stats
export const getStats = async (req, res) => {
  try {
    const supervisorId = req.user.id;

    const internships = await Internship.findAll({
      where: { professionalSupervisorId: supervisorId },
    });

    const studentIds = internships.map((i) => i.studentId);

    const totalTasks = await Task.count({
      where: { supervisorId },
    });

    const completedTasks = await Task.count({
      where: { supervisorId, completed: true },
    });

    const pendingTasks = await Task.count({
      where: { supervisorId, status: "pending" },
    });

    const inProgressTasks = await Task.count({
      where: { supervisorId, status: "in_progress" },
    });

    const avgProgress = totalTasks > 0
      ? Math.round(await Task.sum("progress", { where: { supervisorId } }) / totalTasks)
      : 0;

    return res.status(200).json({
      totalInterns: studentIds.length,
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      avgProgress,
    });
  } catch (error) {
    console.error("GET PROFESSIONAL SUPERVISOR STATS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching stats",
      error: error.message,
    });
  }
};

const generateJitsiLink = (meetingId, title) => {
  const slug = `${title || "meeting"}-${meetingId}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://meet.jit.si/${slug}`;
};

// GET /api/professional-supervisor/meetings
export const getMeetings = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { status } = req.query;

    const where = { createdBy: supervisorId };
    if (status && status !== "all") where.status = status;

    const meetings = await Meeting.findAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
        {
          model: Student,
          as: "meetingStudent",
          include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }],
        },
      ],
      order: [["date", "ASC"]],
    });

    return res.status(200).json({ meetings });
  } catch (error) {
    console.error("GET PROFESSIONAL SUPERVISOR MEETINGS ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// POST /api/professional-supervisor/meetings
export const createMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { studentId, studentIds, title, description, date, location, meetingLink, isGroupMeeting } = req.body;

    if (!title || !date) {
      return res.status(400).json({ message: "title and date are required" });
    }

    if (!studentId && !studentIds?.length) {
      return res.status(400).json({ message: "Select at least one student" });
    }

    const meetingDate = new Date(date);
    if (Number.isNaN(meetingDate.getTime()) || meetingDate <= new Date()) {
      return res.status(400).json({ message: "Please choose a future date and time for the meeting" });
    }

    const selectedStudentIds = isGroupMeeting && studentIds ? studentIds : [studentId];

    for (const sid of selectedStudentIds) {
      const internship = await Internship.findOne({
        where: { studentId: sid, professionalSupervisorId: supervisorId },
      });
      if (!internship) {
        return res.status(403).json({ message: "You are not assigned to one or more selected students" });
      }
    }

    const jitsiLink = meetingLink?.startsWith("https://meet.jit.si/")
      ? meetingLink
      : generateJitsiLink(`professional-${supervisorId}`, title);

    const meeting = await Meeting.create({
      studentId: isGroupMeeting ? null : selectedStudentIds[0],
      studentIds: isGroupMeeting ? selectedStudentIds : null,
      isGroupMeeting: !!isGroupMeeting,
      title,
      description: description || "",
      date: meetingDate,
      location: location || null,
      meetingLink: jitsiLink,
      status: "scheduled",
      createdBy: supervisorId,
    });

    const full = await Meeting.findByPk(meeting.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
        {
          model: Student,
          as: "meetingStudent",
          include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }],
        },
      ],
    });

    return res.status(201).json({ message: "Meeting scheduled successfully", meeting: full });
  } catch (error) {
    console.error("CREATE PROFESSIONAL SUPERVISOR MEETING ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/professional-supervisor/meetings/:id
export const updateMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;
    const { title, description, date, location, meetingLink, status } = req.body;

    const meeting = await Meeting.findOne({ where: { id, createdBy: supervisorId } });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = date;
    if (location !== undefined) updateData.location = location;
    if (meetingLink !== undefined) {
      updateData.meetingLink = meetingLink.startsWith("https://meet.jit.si/")
        ? meetingLink
        : generateJitsiLink(`professional-${supervisorId}-${id}`, title || meeting.title);
    }
    if (status !== undefined) updateData.status = status;

    await meeting.update(updateData);
    return res.status(200).json({ message: "Meeting updated", meeting });
  } catch (error) {
    console.error("UPDATE PROFESSIONAL SUPERVISOR MEETING ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// DELETE /api/professional-supervisor/meetings/:id
export const deleteMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;

    const meeting = await Meeting.findOne({ where: { id, createdBy: supervisorId } });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    await meeting.destroy();
    return res.status(200).json({ message: "Meeting deleted" });
  } catch (error) {
    console.error("DELETE PROFESSIONAL SUPERVISOR MEETING ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PUT /api/professional-supervisor/meetings/:id/initiate
export const initiateMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;

    const meeting = await Meeting.findOne({ where: { id, createdBy: supervisorId } });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const updatedLink = meeting.meetingLink?.startsWith("https://meet.jit.si/")
      ? meeting.meetingLink
      : generateJitsiLink(`professional-${supervisorId}-${id}`, meeting.title);

    await meeting.update({ status: "scheduled", meetingLink: updatedLink });
    return res.status(200).json({ message: "Meeting initiated", meeting, link: updatedLink });
  } catch (error) {
    console.error("INITIATE PROFESSIONAL SUPERVISOR MEETING ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET /api/professional-supervisor/interns/:studentId/grade
export const getFinalGrade = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { studentId } = req.params;

    const internship = await Internship.findOne({
      where: { studentId, professionalSupervisorId: supervisorId },
    });

    if (!internship) {
      return res.status(403).json({ message: "You are not assigned to this student" });
    }

    const maxTotal = internship.professionalGradeBreakdown?.reduce((sum, item) => sum + (item.max || 0), 0) || 0;

    return res.status(200).json({
      grade: {
        finalGrade: internship.professionalGrade,
        maxTotal,
        breakdown: internship.professionalGradeBreakdown,
        gradeStatus: internship.professionalGradeStatus,
        gradeSubmittedAt: internship.professionalGradeSubmittedAt,
      },
    });
  } catch (error) {
    console.error("GET PROFESSIONAL SUPERVISOR FINAL GRADE ERROR:", error);
    return res.status(500).json({ message: "Server error while fetching grade", error: error.message });
  }
};

// POST /api/professional-supervisor/interns/:studentId/grade
export const submitFinalGrade = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { studentId } = req.params;
    const { breakdown } = req.body;

    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      return res.status(400).json({ message: "A grade breakdown is required" });
    }

    const internship = await Internship.findOne({
      where: { studentId, professionalSupervisorId: supervisorId },
    });

    if (!internship) {
      return res.status(403).json({ message: "You are not assigned to this student" });
    }

    const rubric = breakdown.map((item) => ({
      label: String(item.label || "Criterion"),
      score: Math.max(0, Number(item.score) || 0),
      max: Math.max(1, Number(item.max) || 10),
    }));

    const rubricMaxTotal = rubric.reduce((sum, item) => sum + item.max, 0);
    const normalized = rubric.map((item) => {
      const max = (item.max / rubricMaxTotal) * 10;
      const score = Math.min(item.score, item.max);
      return {
        label: item.label,
        score: Number(((score / item.max) * max).toFixed(2)),
        max: Number(max.toFixed(2)),
      };
    });

    const total = Number(Math.min(10, normalized.reduce((sum, item) => sum + item.score, 0)).toFixed(2));
    const maxTotal = 10;

    await internship.update({
      professionalGrade: total,
      professionalGradeBreakdown: normalized,
      professionalGradeStatus: "submitted",
      professionalGradeSubmittedAt: new Date(),
      professionalGradeSubmittedBy: supervisorId,
    });

    const student = await Student.findByPk(studentId);
    if (student?.userId) {
      await Notification.create({
        userId: student.userId,
        title: "Professional supervisor grade submitted",
        message: `Your professional supervisor submitted your grade: ${total}/${maxTotal} (10%).`,
        type: "success",
      });
    }

    return res.status(200).json({
      message: "Final grade submitted successfully",
      grade: {
        finalGrade: total,
        maxTotal,
        breakdown: normalized,
        gradeStatus: "submitted",
        gradeSubmittedAt: internship.professionalGradeSubmittedAt,
      },
    });
  } catch (error) {
    console.error("SUBMIT PROFESSIONAL SUPERVISOR FINAL GRADE ERROR:", error);
    return res.status(500).json({ message: "Server error while submitting grade", error: error.message });
  }
};
