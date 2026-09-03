import { Op } from "sequelize";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import Report from "../models/reportModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import Internship from "../models/studentAssignmentModel.js";

const generateJitsiLink = (meetingId, title) => {
  const slug = `${title || "meeting"}-${meetingId}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://meet.jit.si/${slug}`;
};

// GET /api/supervisor/my-interns
export const getMyInterns = async (req, res) => {
  try {
    const supervisorId = req.user.id;

    const internships = await Internship.findAll({
      where: { academicSupervisorId: supervisorId },
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

    const interns = await Promise.all(internships.map(async (internship) => {
      const report = await Report.findOne({
        where: { studentId: internship.studentId },
        order: [["updatedAt", "DESC"], ["id", "DESC"]],
        attributes: ["id"],
      });
      return {
        id: internship.student?.id,
        name: internship.student?.user?.name,
        email: internship.student?.user?.email,
        matricule: internship.student?.matricule,
        class: internship.student?.class,
        company: internship.company,
        reportId: report?.id || null,
      };
    })).then((items) => items.filter((item) => item.id));

    return res.status(200).json({ interns, total: interns.length });
  } catch (error) {
    console.error("GET MY INTERNS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching interns",
      error: error.message,
    });
  }
};

// GET /api/supervisor/meetings
export const getSupervisorMeetings = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { status, search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { createdBy: supervisorId };
    if (status && status !== "all") {
      where.status = status;
    }

    const include = [
      {
        model: Student,
        as: "meetingStudent",
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

    const { count, rows: meetings } = await Meeting.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset,
      order: [["date", "ASC"]],
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    return res.status(200).json({
      meetings,
      total: count,
      page: parseInt(page),
      totalPages,
    });
  } catch (error) {
    console.error("GET SUPERVISOR MEETINGS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching meetings",
      error: error.message,
    });
  }
};

// POST /api/supervisor/meetings
export const createSupervisorMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { studentId, studentIds, title, description, date, location, meetingLink, isGroupMeeting } = req.body;

    if (!title || !date) {
      return res.status(400).json({ message: "title and date are required" });
    }

    if (!studentId && !studentIds?.length) {
      return res.status(400).json({ message: "Select at least one student" });
    }

    const selectedStudentIds = isGroupMeeting && studentIds ? studentIds : [studentId];

    for (const sid of selectedStudentIds) {
      const internship = await Internship.findOne({
        where: { studentId: sid, academicSupervisorId: supervisorId },
      });
      if (!internship) {
        return res.status(403).json({ message: "You are not assigned to one or more selected students" });
      }
    }

    const jitsiLink = meetingLink?.startsWith("https://meet.jit.si/")
      ? meetingLink
      : generateJitsiLink(supervisorId, title);

    const meeting = await Meeting.create({
      studentId: isGroupMeeting ? null : selectedStudentIds[0],
      studentIds: isGroupMeeting ? selectedStudentIds : null,
      isGroupMeeting: !!isGroupMeeting,
      title,
      description: description || "",
      date,
      location: location || null,
      meetingLink: jitsiLink,
      status: "scheduled",
      createdBy: supervisorId,
    });

    const createdMeeting = await Meeting.findByPk(meeting.id, {
      include: [
        {
          model: Student,
          as: "meetingStudent",
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
      message: "Meeting scheduled successfully",
      meeting: createdMeeting,
    });
  } catch (error) {
    console.error("CREATE SUPERVISOR MEETING ERROR:", error);
    return res.status(500).json({
      message: "Server error while creating meeting",
      error: error.message,
    });
  }
};

// PUT /api/supervisor/meetings/:id
export const updateSupervisorMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;
    const { title, description, date, location, meetingLink, status } = req.body;

    const meeting = await Meeting.findOne({
      where: { id, createdBy: supervisorId },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) {
      const meetingDate = new Date(date);
      if (Number.isNaN(meetingDate.getTime())) {
        return res.status(400).json({ message: "Please provide a valid meeting date and time" });
      }
      updateData.date = meetingDate;
    }
    if (location !== undefined) updateData.location = location;
    if (meetingLink !== undefined) {
      updateData.meetingLink = meetingLink.startsWith("https://meet.jit.si/")
        ? meetingLink
        : generateJitsiLink(`${supervisorId}-${id}`, title || meeting.title);
    }
    if (status !== undefined) updateData.status = status;

    await meeting.update(updateData);

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

// DELETE /api/supervisor/meetings/:id
export const deleteSupervisorMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;

    const meeting = await Meeting.findOne({
      where: { id, createdBy: supervisorId },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    await meeting.destroy();

    return res.status(200).json({
      message: "Meeting deleted successfully",
    });
  } catch (error) {
    console.error("DELETE MEETING ERROR:", error);
    return res.status(500).json({
      message: "Server error while deleting meeting",
      error: error.message,
    });
  }
};

// PUT /api/supervisor/meetings/:id/initiate
export const initiateMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;

    const meeting = await Meeting.findOne({
      where: { id, createdBy: supervisorId },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const updatedLink = meeting.meetingLink?.startsWith("https://meet.jit.si/")
      ? meeting.meetingLink
      : generateJitsiLink(`academic-${supervisorId}-${id}`, meeting.title);
    await meeting.update({
      status: "scheduled",
      meetingLink: updatedLink,
    });

    return res.status(200).json({
      message: "Meeting initiated successfully",
      meeting,
      link: updatedLink,
    });
  } catch (error) {
    console.error("INITIATE SUPERVISOR MEETING ERROR:", error);
    return res.status(500).json({
      message: "Server error while initiating meeting",
      error: error.message,
    });
  }
};

// GET /api/supervisor/notifications
export const getSupervisorNotifications = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: { userId: supervisorId },
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    return res.status(200).json({
      notifications,
      total: count,
      page: parseInt(page),
      totalPages,
    });
  } catch (error) {
    console.error("GET SUPERVISOR NOTIFICATIONS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching notifications",
      error: error.message,
    });
  }
};

// PUT /api/supervisor/notifications/:id/read
export const markSupervisorNotificationRead = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, userId: supervisorId },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await notification.update({ isRead: true });

    return res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("MARK NOTIFICATION READ ERROR:", error);
    return res.status(500).json({
      message: "Server error while updating notification",
      error: error.message,
    });
  }
};

// GET /api/supervisor/reports
export const getSupervisorReports = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { status, search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const internships = await Internship.findAll({
      where: { academicSupervisorId: supervisorId },
      attributes: ["studentId"],
    });

    const studentIds = internships.map((i) => i.studentId);

    const where = { studentId: studentIds };
    if (status && status !== "all") {
      where.status = status;
    } else {
      // Only show reports that have left the student's draft/AI stage
      where.status = { [Op.notIn]: ["submitted", "ai_analysis"] };
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
          { title: { [Op.like]: `%${search}%` } },
        ],
      };
      include[0].required = true;
    }

    const { count, rows: reports } = await Report.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset,
      order: [["submittedAt", "DESC"]],
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    return res.status(200).json({
      reports,
      total: count,
      page: parseInt(page),
      totalPages,
    });
  } catch (error) {
    console.error("GET SUPERVISOR REPORTS ERROR:", error);
    return res.status(500).json({
      message: "Server error while fetching reports",
      error: error.message,
    });
  }
};

// PUT /api/supervisor/reports/:id/feedback
export const submitReportFeedback = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { id } = req.params;
    const { feedback, status } = req.body;

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const student = await Student.findByPk(report.studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const internship = await Internship.findOne({
      where: { studentId: student.id, academicSupervisorId: supervisorId },
    });

    if (!internship) {
      return res.status(403).json({ message: "You are not assigned to this student" });
    }

    const updateData = {
      supervisorFeedback: feedback || report.supervisorFeedback,
      supervisorFeedbackBy: supervisorId,
      supervisorFeedbackAt: new Date(),
    };

    if (status) {
      updateData.status = status;
    }

    await report.update(updateData);

    await Notification.create({
      userId: student.userId,
      title: "Supervisor feedback received",
      message: `Your supervisor has reviewed \"${report.title}\".`,
      type: status === "approved" ? "success" : "info",
    });

    return res.status(200).json({
      message: "Feedback submitted successfully",
      report,
    });
  } catch (error) {
    console.error("SUBMIT FEEDBACK ERROR:", error);
    return res.status(500).json({
      message: "Server error while submitting feedback",
      error: error.message,
    });
  }
};

// GET /api/supervisor/interns/:studentId/grade
export const getFinalGrade = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { studentId } = req.params;

    const internship = await Internship.findOne({
      where: { studentId, academicSupervisorId: supervisorId },
    });

    if (!internship) {
      return res.status(403).json({ message: "You are not assigned to this student" });
    }

    const maxTotal = internship.academicGradeBreakdown?.reduce((sum, item) => sum + (item.max || 0), 0) || 0;

    return res.status(200).json({
      grade: {
        finalGrade: internship.academicGrade,
        maxTotal,
        breakdown: internship.academicGradeBreakdown,
        gradeStatus: internship.academicGradeStatus,
        gradeSubmittedAt: internship.academicGradeSubmittedAt,
      },
    });
  } catch (error) {
    console.error("GET FINAL GRADE ERROR:", error);
    return res.status(500).json({ message: "Server error while fetching grade", error: error.message });
  }
};

// POST /api/supervisor/interns/:studentId/grade
export const submitFinalGrade = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { studentId } = req.params;
    const { breakdown } = req.body;

    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      return res.status(400).json({ message: "A grade breakdown is required" });
    }

    const internship = await Internship.findOne({
      where: { studentId, academicSupervisorId: supervisorId },
    });

    if (!internship) {
      return res.status(403).json({ message: "You are not assigned to this student" });
    }

    const normalized = breakdown.map((item) => ({
      label: String(item.label || "Criterion"),
      score: Math.max(0, Number(item.score) || 0),
      max: Math.max(1, Number(item.max) || 0),
    }));

    const total = normalized.reduce((sum, item) => sum + item.score, 0);
    const maxTotal = normalized.reduce((sum, item) => sum + item.max, 0);

    await internship.update({
      academicGrade: total,
      academicGradeBreakdown: normalized,
      academicGradeStatus: "submitted",
      academicGradeSubmittedAt: new Date(),
      academicGradeSubmittedBy: supervisorId,
    });

    const student = await Student.findByPk(studentId);
    if (student?.userId) {
      await Notification.create({
        userId: student.userId,
        title: "Academic supervisor grade submitted",
        message: `Your academic supervisor submitted your grade: ${total}/${maxTotal} (20%).`,
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
        gradeSubmittedAt: internship.academicGradeSubmittedAt,
      },
    });
  } catch (error) {
    console.error("SUBMIT FINAL GRADE ERROR:", error);
    return res.status(500).json({ message: "Server error while submitting grade", error: error.message });
  }
};
