import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  role: {
    type: DataTypes.ENUM(
      "student",
      "academic_supervisor",
      "professional_supervisor",
      "admin"
    ),
    allowNull: false,
  },

  mustChangePassword: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  status: {
    type: DataTypes.ENUM("online", "offline", "logged_in", "logged_out", "deactivated"),
    allowNull: false,
    defaultValue: "logged_out",
  },

  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  lastLogoutAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  deactivatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // Password-reset one-time code.
  // The 6-digit code is stored only as a bcrypt hash, so someone with read access
  // to this table cannot use the value directly. otpAttempts caps brute-force
  // guessing and the CPU cost of repeated bcrypt comparisons.
  otpCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  otpExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  otpAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  // Supervisor onboarding profile.
  //
  // An account created on demand for a supervisor is handed temporary
  // credentials; on first login the holder is walked through a password change
  // and then confirms these details. `onboardingCompletedAt` is null until that
  // confirmation, which is what gates the supervisor surfaces.
  //
  // Accounts that already existed when this feature landed are backfilled at
  // migration time, so only genuinely new accounts are gated — an established
  // supervisor is never pushed back through onboarding. See
  // `ensureUserOnboardingColumns` in server.js.
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  organisation: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  jobTitle: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  onboardingCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default User;