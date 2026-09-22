import User from "../models/userModel.js";
import { requiresOnboarding, SUPERVISOR_ROLES } from "../utils/onboarding.js";

const PROFILE_ATTRIBUTES = [
  "id",
  "name",
  "email",
  "role",
  "phone",
  "organisation",
  "jobTitle",
  "onboardingCompletedAt",
];

const profileShape = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  organisation: user.organisation,
  jobTitle: user.jobTitle,
  onboardingCompletedAt: user.onboardingCompletedAt,
  requiresOnboarding: requiresOnboarding(user),
});

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: {
        exclude: ["password"],
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User retrieved successfully",
      user,
    });

  } catch (error) {
    console.error("GET USER BY ID ERROR:", error);

    return res.status(500).json({
      message: "Server error while retrieving user",
      error: error.message,
    });
  }
};

// GET /api/users/me  (authenticated, any role)
//
// Deliberately NOT behind a role guard. It only ever returns the caller's own
// record, and a supervisor who has not finished onboarding must be able to reach
// it - a role guard would refuse them here and leave them with no way to un-gate
// themselves, since the role guard is exactly what enforces the gate.
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: PROFILE_ATTRIBUTES });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: profileShape(user) });
  } catch (error) {
    console.error("GET MY PROFILE ERROR:", error);
    return res.status(500).json({
      message: "Server error while retrieving your profile",
      error: error.message,
    });
  }
};

// PUT /api/users/me/onboarding  (authenticated supervisor)
//
// Two jobs behind one endpoint: it completes onboarding the first time, and it
// lets the holder correct their details afterwards. `onboardingCompletedAt` is
// only stamped on the first completion so the "completed on" date stays truthful.
export const completeOnboarding = async (req, res) => {
  try {
    const { name, phone, organisation, jobTitle } = req.body || {};

    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!SUPERVISOR_ROLES.includes(user.role)) {
      return res.status(400).json({
        message: "Profile onboarding applies to supervisor accounts.",
      });
    }

    // These four are the whole profile, so all of them are required - a blank
    // field here would defeat the point of collecting them.
    const cleaned = {
      name: String(name ?? "").trim(),
      phone: String(phone ?? "").trim(),
      organisation: String(organisation ?? "").trim(),
      jobTitle: String(jobTitle ?? "").trim(),
    };

    const missing = Object.entries(cleaned)
      .filter(([, value]) => !value)
      .map(([field]) => field);

    if (missing.length > 0) {
      return res.status(400).json({
        message: "Please complete every field before confirming.",
        missing,
      });
    }

    if (cleaned.name.length > 255 || cleaned.phone.length > 255 ||
        cleaned.organisation.length > 255 || cleaned.jobTitle.length > 255) {
      return res.status(400).json({ message: "One or more fields are too long." });
    }

    const updates = {
      name: cleaned.name,
      phone: cleaned.phone,
      organisation: cleaned.organisation,
      jobTitle: cleaned.jobTitle,
    };

    const isFirstCompletion = !user.onboardingCompletedAt;
    if (isFirstCompletion) {
      updates.onboardingCompletedAt = new Date();
    }

    await user.update(updates);

    return res.status(200).json({
      message: isFirstCompletion
        ? "Your profile is complete. Welcome to InternSmart."
        : "Your profile has been updated.",
      completedOnboarding: isFirstCompletion,
      user: profileShape(user),
    });
  } catch (error) {
    console.error("COMPLETE ONBOARDING ERROR:", error);
    return res.status(500).json({
      message: "Server error while saving your profile",
      error: error.message,
    });
  }
};
