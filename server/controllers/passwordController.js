import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/userModel.js";
import { sendPasswordResetEmail } from "../utils/sendEmail.js";

// Password reset policy
const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

// Reset tokens are signed with a secret *derived* from JWT_SECRET rather than
// JWT_SECRET itself, so the two token types are mutually unusable: an access
// token fails verification here, and a reset token fails verification in
// authMiddleware. The `purpose` claim is checked as a second line of defence.
const resetSecret = () => `${process.env.JWT_SECRET}:password-reset`;

// Cryptographically secure 6-digit code (100000-999999, never leading-zero).
const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Matches the inline policy in changePassword below.
const passwordPolicyError = (password) => {
  if (!password || password.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
  if (!/\d/.test(password)) return "Password must contain a number";
  if (!/[!@#$%^&*]/.test(password)) return "Password must contain a special character";
  return null;
};

// POST /api/users/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    // One identical response for every outcome, so this endpoint cannot be used
    // to discover which addresses have accounts.
    const genericResponse = {
      message: "If an account with this email exists, a password reset code has been sent.",
      expiresInMinutes: OTP_TTL_MINUTES,
    };

    const user = await User.findOne({ where: { email } });
    if (!user || user.active === false) {
      return res.status(200).json(genericResponse);
    }

    const code = generateOtp();
    const hashedCode = await bcrypt.hash(code, 10);

    await user.update({
      otpCode: hashedCode,
      otpExpires: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      otpAttempts: 0,
    });

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        code,
        expiresInMinutes: OTP_TTL_MINUTES,
      });
    } catch (emailError) {
      // Do not surface delivery failures to the caller - that would reveal that
      // the address exists. Clear the unusable code and log it instead.
      await user.update({ otpCode: null, otpExpires: null, otpAttempts: 0 });
      console.error("PASSWORD RESET EMAIL FAILED:", emailError.message);
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Error processing request",
      error: error.message,
    });
  }
};

// POST /api/users/verify-otp
const verifyOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "The reset code must be 6 digits" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user || !user.otpCode || !user.otpExpires) {
      return res.status(400).json({ message: "That code is not valid. Please request a new one." });
    }

    if (new Date(user.otpExpires).getTime() < Date.now()) {
      await user.update({ otpCode: null, otpExpires: null, otpAttempts: 0 });
      return res.status(400).json({ message: "That code has expired. Please request a new one." });
    }

    if ((user.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      await user.update({ otpCode: null, otpExpires: null, otpAttempts: 0 });
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new code." });
    }

    const matches = await bcrypt.compare(code, user.otpCode);

    if (!matches) {
      const attempts = (user.otpAttempts || 0) + 1;
      await user.update({ otpAttempts: attempts });
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - attempts);
      return res.status(400).json({
        message: `That code is not valid. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      });
    }

    const resetToken = jwt.sign(
      { id: user.id, purpose: "password_reset" },
      resetSecret(),
      { expiresIn: `${OTP_TTL_MINUTES}m` }
    );

    return res.status(200).json({
      message: "Code verified. You can now choose a new password.",
      resetToken,
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);
    return res.status(500).json({
      message: "Error verifying code",
      error: error.message,
    });
  }
};

// POST /api/users/reset-password
const resetPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const { resetToken, newPassword, confirmPassword } = req.body || {};

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        message: "Email, reset token and new password are required",
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      return res.status(400).json({ message: policyError });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, resetSecret());
    } catch {
      return res.status(401).json({
        message: "Your reset session has expired. Please request a new code.",
      });
    }

    if (decoded.purpose !== "password_reset") {
      return res.status(401).json({ message: "Invalid reset token" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user || user.id !== decoded.id) {
      return res.status(400).json({ message: "This reset request is no longer valid. Please start again." });
    }

    // Single use: consuming the reset clears otpCode, so replaying the same
    // token afterwards is rejected here.
    if (!user.otpCode) {
      return res.status(400).json({
        message: "This reset request has already been used. Please request a new code.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      password: hashedPassword,
      mustChangePassword: false,
      otpCode: null,
      otpExpires: null,
      otpAttempts: 0,
    });

    return res.status(200).json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Error resetting password",
      error: error.message,
    });
  }
};

// PUT /api/users/change-password  (authenticated)
const changePassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    // Check fields
    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Check confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New passwords do not match",
      });
    }

    // Password validation
    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        message: "Password must contain an uppercase letter",
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        message: "Password must contain a lowercase letter",
      });
    }

    if (!/\d/.test(newPassword)) {
      return res.status(400).json({
        message: "Password must contain a number",
      });
    }

    if (!/[!@#$%^&*]/.test(newPassword)) {
      return res.status(400).json({
        message: "Password must contain a special character",
      });
    }

    // Find user using the ID from the verified JWT
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    // Update password
    await user.update({
      password: hashedPassword,
      mustChangePassword: false,
    });

    return res.status(200).json({
      message: "Password changed successfully",
    });

  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Error changing password",
      error: error.message,
    });
  }
};

export { changePassword, forgotPassword, verifyOtp, resetPassword };
