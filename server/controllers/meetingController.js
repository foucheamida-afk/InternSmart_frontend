import Meeting from "../models/meetingModel.js";
import Internship from "../models/studentAssignmentModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";
import { Op } from "sequelize";

// ─── SUPERVISOR: Schedule a meeting ─────────────────────────────────────────
// POST /api/meetings/schedule
export const scheduleMeeting = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const { studentId, title, description, date, location, meetingLink } = req.body;

    if (!studentId || !title || !date) {
      return res.status(400).json({ message: "studentId, title, and date are required" });
    }

    const meetingDate = new Date(date);
    if (Number.isNaN(meetingDate.getTime()) || meetingDate <= new Date()) {
      return res.status(400).json({ message: "Please choose a future date and time for the meeting" });
    }

    // Verify the supervisor is assigned to this student
    const internship = await Internship.findOne({
      where: { studentId, academicSupervisorId: supervisorId },
    });
    if (!internship) {
      return res.status(403).json({ message: "You are not assigned to this student" });
    }

    const meeting = await Meeting.create({
      studentId,
      title,
      description: description || "",
      date: meetingDate,
      location: location || null,
      meetingLink: meetingLink || null,
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
    if (meetingLink !== undefined) updateData.meetingLink = meetingLink;
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

    // Optionally generate a simple meeting link if none exists
    const updatedLink = meeting.meetingLink || `https://meet.internsmart.app/room/${id}-${Date.now()}`;

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

    const meetings = await Meeting.findAll({
      where: {
        studentId: student.id,
        date: { [Op.gte]: new Date() },
        status: "scheduled",
      },
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
      ],
      order: [["date", "ASC"]],
    });

    return res.status(200).json({ meetings });
  } catch (error) {
    console.error("GET STUDENT MEETINGS ERROR:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
