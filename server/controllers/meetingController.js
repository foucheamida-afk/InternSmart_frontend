import Meeting from "../models/meetingModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import { Op } from "sequelize";

const generateJitsiLink = (meetingId, title) => {
  const slug = `${title || "meeting"}-${meetingId}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://meet.jit.si/${slug}`;
};

// ─── SUPERVISOR: Schedule a meeting ─────────────────────────────────────────
// POST /api/meetings/schedule
export const scheduleMeeting = async (req, res) => {
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
        where: { studentId: sid, academicSupervisorId: supervisorId },
      });
      if (!internship) {
        return res.status(403).json({ message: "You are not assigned to one or more selected students" });
      }
    }

    const jitsiLink = meetingLink?.startsWith("https://meet.jit.si/")
      ? meetingLink
      : generateJitsiLink(`supervisor-${supervisorId}`, title);

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
    console.error("SCHEDULE MEETING ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─── SUPERVISOR: Get all meetings created by this supervisor ──────────────────
// GET /api/meetings/supervisor
export const getSupervisorMeetingsList = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { status } = req.query;

    const where = { createdBy: supervisorId };
    if (status && status !== "all") where.status = status;

    const meetings = await Meeting.findAll({
      where,
      include: [
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
    console.error("GET SUPERVISOR MEETINGS LIST ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─── SUPERVISOR: Update meeting ───────────────────────────────────────────────
// PUT /api/meetings/:id
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
        : generateJitsiLink(`supervisor-${supervisorId}-${id}`, title || meeting.title);
    }
    if (status !== undefined) updateData.status = status;

    await meeting.update(updateData);
    return res.status(200).json({ message: "Meeting updated", meeting });
  } catch (error) {
    console.error("UPDATE MEETING ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─── SUPERVISOR: Delete meeting ───────────────────────────────────────────────
// DELETE /api/meetings/:id
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
    console.error("DELETE MEETING ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─── SUPERVISOR: Initiate/start a meeting (mark as in-progress) ───────────────
// PUT /api/meetings/:id/initiate
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
      : generateJitsiLink(`supervisor-${supervisorId}-${id}`, meeting.title);

    await meeting.update({ status: "scheduled", meetingLink: updatedLink });
    return res.status(200).json({ message: "Meeting initiated", meeting, link: updatedLink });
  } catch (error) {
    console.error("INITIATE MEETING ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ─── STUDENT: Get upcoming meetings ──────────────────────────────────────────
// GET /api/meetings/student
export const getStudentMeetings = async (req, res) => {
  try {
    const userId = req.user.id;

    const student = await Student.findOne({ where: { userId } });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const now = new Date();

    const upcomingMeetings = await Meeting.findAll({
      where: {
        studentId: student.id,
        date: { [Op.gte]: now },
        status: "scheduled",
      },
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
      ],
      order: [["date", "ASC"]],
    });

    const meetingHistory = await Meeting.findAll({
      where: {
        studentId: student.id,
        date: { [Op.lt]: now },
      },
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
      ],
      order: [["date", "DESC"]],
      limit: 20,
    });

    return res.status(200).json({
      meetings: upcomingMeetings,
      upcomingMeetings,
      meetingHistory,
    });
  } catch (error) {
    console.error("GET STUDENT MEETINGS ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
