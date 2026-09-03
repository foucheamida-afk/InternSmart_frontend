import { Op } from "sequelize";
import Task from "../models/taskModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import Internship from "../models/studentAssignmentModel.js";

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
    const { studentId, title, description, dueDate } = req.body;

    if (!studentId || !title) {
      return res.status(400).json({ message: "Student and title are required" });
    }

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const internship = await Internship.findOne({
      where: { studentId: student.id, academicSupervisorId: supervisorId },
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
    console.error("UPDATE TASK ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating task",
      error: error.message,
    });
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
      feedbackAcademic: feedback.trim(),
      feedbackAcademicAt: new Date(),
      feedbackAcademicBy: supervisorId,
    });

    return res.status(200).json({ message: "Feedback submitted", task });
  } catch (error) {
    console.error("SUBMIT TASK FEEDBACK ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
