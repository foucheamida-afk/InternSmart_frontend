import { Op } from "sequelize";
import TimelineSetting from "../models/timelineSettingModel.js";

const normalizeMilestones = (milestones) => {
  if (!Array.isArray(milestones)) return [];
  return milestones
    .map((item) => ({
      title: String(item?.title || "").trim(),
      date: item?.date || null,
    }))
    .filter((item) => item.title);
};

// MySQL returns JSON columns as strings; ensure we always return an array.
const parseMilestones = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const serialize = (setting) => ({
  id: setting.id,
  label: setting.label,
  startDate: setting.startDate,
  endDate: setting.endDate,
  milestones: parseMilestones(setting.milestones),
  createdAt: setting.createdAt,
  updatedAt: setting.updatedAt,
});

// GET /api/admin/timeline  (admin) -> list all timelines
export const listTimelines = async (req, res) => {
  try {
    const timelines = await TimelineSetting.findAll({ order: [["startDate", "DESC"], ["createdAt", "DESC"]] });
    return res.status(200).json({ timelines: timelines.map(serialize) });
  } catch (error) {
    console.error("LIST TIMELINES ERROR:", error);
    return res.status(500).json({ message: "Server error while fetching timelines", error: error.message });
  }
};

// POST /api/admin/timeline  (admin) -> create a new timeline (does not overwrite)
export const createTimeline = async (req, res) => {
  try {
    const { label, startDate, endDate, milestones } = req.body;

    const setting = await TimelineSetting.create({
      label: label || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      milestones: normalizeMilestones(milestones),
    });

    return res.status(201).json({ message: "Internship timeline created", timeline: serialize(setting) });
  } catch (error) {
    console.error("CREATE TIMELINE ERROR:", error);
    return res.status(500).json({ message: "Server error while creating timeline", error: error.message });
  }
};

// PUT /api/admin/timeline/:id  (admin) -> update one timeline
export const updateTimeline = async (req, res) => {
  try {
    const { label, startDate, endDate, milestones } = req.body;

    const setting = await TimelineSetting.findByPk(req.params.id);
    if (!setting) return res.status(404).json({ message: "Timeline not found" });

    await setting.update({
      label: label !== undefined ? label : setting.label,
      startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : setting.startDate,
      endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : setting.endDate,
      milestones: milestones !== undefined ? normalizeMilestones(milestones) : setting.milestones,
    });

    return res.status(200).json({ message: "Internship timeline updated", timeline: serialize(setting) });
  } catch (error) {
    console.error("UPDATE TIMELINE ERROR:", error);
    return res.status(500).json({ message: "Server error while updating timeline", error: error.message });
  }
};

// DELETE /api/admin/timeline/:id  (admin)
export const deleteTimeline = async (req, res) => {
  try {
    const setting = await TimelineSetting.findByPk(req.params.id);
    if (!setting) return res.status(404).json({ message: "Timeline not found" });

    await setting.destroy();
    return res.status(200).json({ message: "Internship timeline deleted" });
  } catch (error) {
    console.error("DELETE TIMELINE ERROR:", error);
    return res.status(500).json({ message: "Server error while deleting timeline", error: error.message });
  }
};

// GET /api/timeline  (any authenticated user: students & supervisors) -> latest timeline
export const getPublicTimeline = async (req, res) => {
  try {
    const timelines = await TimelineSetting.findAll({ order: [["startDate", "DESC"], ["createdAt", "DESC"]] });
    const latest = timelines[0] || null;

    return res.status(200).json({
      timeline: latest
        ? serialize(latest)
        : { label: null, startDate: null, endDate: null, milestones: [] },
    });
  } catch (error) {
    console.error("GET PUBLIC TIMELINE ERROR:", error);
    return res.status(500).json({ message: "Server error while fetching timeline", error: error.message });
  }
};
