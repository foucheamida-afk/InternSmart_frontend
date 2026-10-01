import { Op } from "sequelize";
import Task from "../models/taskModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Notification from "../models/notificationModel.js";

// Helper: Verify if supervisor is assigned to student
const checkSupervisorAssignment = async (supervisorId, supervisorRole, studentId) => {
  const where = { studentId };
  if (supervisorRole === "academic_supervisor") {
    where.academicSupervisorId = supervisorId;
  } else if (supervisorRole === "professional_supervisor") {
    where.professionalSupervisorId = supervisorId;
  }
  return await Internship.findOne({ where });
};

// Helper: Calculate automatic progress from milestones
const calculateMilestoneProgress = (milestones) => {
  if (!Array.isArray(milestones) || milestones.length === 0) return null;
  const approvedCount = milestones.filter(
    (m) => m.status === "approved" || m.status === "completed"
  ).length;
  return Math.round((approvedCount / milestones.length) * 100);
};

// GET /api/supervisor/tasks
export const getSupervisorTasks = async (req, res) => {
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
      {
        model: User,
        as: "supervisor",
        attributes: ["id", "name", "email", "role"],
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
    console.error("GET SUPERVISOR TASKS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching tasks",
      error: error.message,
    });
  }
};

// POST /api/supervisor/tasks
export const createTask = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const supervisorRole = req.user.role;
    const { studentId, title, description, dueDate, milestones } = req.body;

    if (!studentId || !title) {
      return res.status(400).json({ message: "Student and title are required" });
    }

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (supervisorRole !== "admin") {
      const assignment = await checkSupervisorAssignment(supervisorId, supervisorRole, student.id);
      if (!assignment) {
        return res.status(403).json({ message: "You are not assigned to this student" });
      }
    }

    // Format milestones if provided
    let formattedMilestones = null;
    if (Array.isArray(milestones) && milestones.length > 0) {
      formattedMilestones = milestones.map((m, idx) => ({
        id: m.id || `${Date.now()}-${idx}`,
        title: m.title || `Milestone ${idx + 1}`,
        description: m.description || "",
        dueDate: m.dueDate || null,
        status: "pending",
        submissionNote: null,
        workUrl: null,
        submittedAt: null,
        feedback: null,
        reviewedAt: null,
      }));
    }

    const task = await Task.create({
      studentId: student.id,
      supervisorId,
      supervisorRole,
      title,
      description: description || "",
      dueDate: dueDate || null,
      milestones: formattedMilestones,
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
        {
          model: User,
          as: "supervisor",
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    // Notify Student
    if (student.userId) {
      const roleLabel = supervisorRole === "professional_supervisor" ? "Professional Supervisor" : "Academic Supervisor";
      await Notification.create({
        userId: student.userId,
        title: "New Task Assigned",
        message: `Your ${roleLabel} assigned a new task: "${title}".`,
        type: "info",
      }).catch((err) => console.error("Notification error:", err));
    }

    return res.status(201).json({
      message: "Task created successfully",
      task: createdTask,
    });
  } catch (error) {
    console.error("CREATE TASK ERROR:", error);
    return res.status(500).json({
      message: "Server error while creating task",
      error: error.message,
    });
  }
};

// PUT /api/supervisor/tasks/:id
export const updateTask = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const supervisorRole = req.user.role;
    const { id } = req.params;
    const { title, description, dueDate, status, progress, feedback, milestones } = req.body;

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

    let updatedMilestones = milestones !== undefined ? milestones : task.milestones;
    if (Array.isArray(updatedMilestones)) {
      updateData.milestones = updatedMilestones;
      const autoProgress = calculateMilestoneProgress(updatedMilestones);
      if (autoProgress !== null) {
        updateData.progress = autoProgress;
        if (autoProgress === 100) {
          updateData.status = "completed";
          updateData.completed = true;
        }
      }
    }

    if (feedback !== undefined) {
      updateData.feedback = feedback;
      if (supervisorRole === "professional_supervisor") {
        updateData.feedbackProfessional = feedback;
        updateData.feedbackProfessionalAt = new Date();
        updateData.feedbackProfessionalBy = supervisorId;
      } else {
        updateData.feedbackAcademic = feedback;
        updateData.feedbackAcademicAt = new Date();
        updateData.feedbackAcademicBy = supervisorId;
      }
    }

    if (status !== undefined) {
      updateData.status = status;
      if (status === "completed" || status === "approved") {
        updateData.completed = true;
        updateData.progress = 100;
        updateData.status = "completed";
      } else if (status === "needs_revision" || status === "rejected") {
        updateData.completed = false;
        updateData.status = "needs_revision";
      } else {
        updateData.completed = false;
      }
    }

    if (progress !== undefined && (!Array.isArray(updatedMilestones) || updatedMilestones.length === 0)) {
      updateData.progress = Math.min(100, Math.max(0, parseInt(progress)));
      if (updateData.progress === 100 && status === undefined) {
        updateData.status = "completed";
        updateData.completed = true;
      }
    }

    await task.update(updateData);

    // Notify student on review / status update
    if (task.student?.user?.id && status) {
      const studentUserId = task.student.user.id;
      const roleLabel = supervisorRole === "professional_supervisor" ? "professional supervisor" : "academic supervisor";
      if (status === "completed" || status === "approved") {
        await Notification.create({
          userId: studentUserId,
          title: "Task Approved!",
          message: `Your ${roleLabel} approved your submission for task "${task.title}".`,
          type: "success",
        }).catch((err) => console.error("Notification error:", err));
      } else if (status === "needs_revision" || status === "rejected") {
        await Notification.create({
          userId: studentUserId,
          title: "Task Revision Requested",
          message: `Your ${roleLabel} reviewed task "${task.title}" and requested changes. Please check feedback and resubmit.`,
          type: "warning",
        }).catch((err) => console.error("Notification error:", err));
      }
    }

    return res.status(200).json({
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("UPDATE TASK ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating task",
      error: error.message,
    });
  }
};

// PUT /api/supervisor/tasks/:id/review (Approve or Reject Task / Milestone)
export const reviewTaskSubmission = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const supervisorRole = req.user.role;
    const { id } = req.params;
    const { action, feedback, milestoneId } = req.body;

    if (!["approve", "reject", "needs_revision"].includes(action)) {
      return res.status(400).json({ message: "Action must be 'approve', 'reject', or 'needs_revision'" });
    }

    const task = await Task.findOne({
      where: { id, supervisorId },
      include: [
        {
          model: Student,
          as: "student",
          include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }],
        },
      ],
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    let milestones = Array.isArray(task.milestones) ? [...task.milestones] : [];
    let isApproved = action === "approve";

    if (milestoneId && milestones.length > 0) {
      milestones = milestones.map((m) => {
        if (String(m.id) === String(milestoneId)) {
          return {
            ...m,
            status: isApproved ? "approved" : "needs_revision",
            feedback: feedback || m.feedback,
            reviewedAt: new Date(),
            reviewedBy: supervisorId,
          };
        }
        return m;
      });
    }

    const autoProgress = calculateMilestoneProgress(milestones);
    const allMilestonesApproved = milestones.length > 0 && milestones.every((m) => m.status === "approved" || m.status === "completed");

    const newProgress = autoProgress !== null ? autoProgress : isApproved ? 100 : task.progress;
    const finalCompleted = allMilestonesApproved || (milestones.length === 0 && isApproved);
    const newStatus = finalCompleted ? "completed" : isApproved ? "in_progress" : "needs_revision";

    const updateData = {
      milestones: milestones.length > 0 ? milestones : task.milestones,
      progress: newProgress,
      completed: finalCompleted,
      status: newStatus,
    };

    if (feedback) {
      updateData.feedback = feedback.trim();
      updateData.feedbackAt = new Date();
      if (supervisorRole === "professional_supervisor") {
        updateData.feedbackProfessional = feedback.trim();
        updateData.feedbackProfessionalAt = new Date();
        updateData.feedbackProfessionalBy = supervisorId;
      } else {
        updateData.feedbackAcademic = feedback.trim();
        updateData.feedbackAcademicAt = new Date();
        updateData.feedbackAcademicBy = supervisorId;
      }
    }

    await task.update(updateData);

    // Notify student
    if (task.student?.user?.id) {
      const studentUserId = task.student.user.id;
      const roleLabel = supervisorRole === "professional_supervisor" ? "professional supervisor" : "academic supervisor";
      await Notification.create({
        userId: studentUserId,
        title: isApproved ? "Submission Approved" : "Revision Requested",
        message: isApproved
          ? `Your ${roleLabel} approved your submission for task "${task.title}".`
          : `Your ${roleLabel} requested changes on task "${task.title}". Feedback: ${feedback || "Please revise."}`,
        type: isApproved ? "success" : "warning",
      }).catch((err) => console.error("Notification error:", err));
    }

    return res.status(200).json({
      message: isApproved ? "Submission approved successfully" : "Revision requested successfully",
      task,
    });
  } catch (error) {
    console.error("REVIEW TASK SUBMISSION ERROR:", error);
    return res.status(500).json({ message: "Server error while reviewing task", error: error.message });
  }
};

// DELETE /api/supervisor/tasks/:id
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
    console.error("DELETE TASK ERROR:", error);
    return res.status(500).json({
      message: "Server error while deleting task",
      error: error.message,
    });
  }
};

// PUT /api/supervisor/tasks/:id/feedback
export const submitTaskFeedback = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const supervisorRole = req.user.role;
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ message: "Feedback text is required" });
    }

    const task = await Task.findOne({ where: { id, supervisorId } });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const updateData = {
      feedback: feedback.trim(),
      feedbackAt: new Date(),
    };

    if (supervisorRole === "professional_supervisor") {
      updateData.feedbackProfessional = feedback.trim();
      updateData.feedbackProfessionalAt = new Date();
      updateData.feedbackProfessionalBy = supervisorId;
    } else {
      updateData.feedbackAcademic = feedback.trim();
      updateData.feedbackAcademicAt = new Date();
      updateData.feedbackAcademicBy = supervisorId;
    }

    await task.update(updateData);

    return res.status(200).json({ message: "Feedback submitted", task });
  } catch (error) {
    console.error("SUBMIT TASK FEEDBACK ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

