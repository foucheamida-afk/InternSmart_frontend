import User from "../models/userModel.js";
import bcrypt from "bcrypt";

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check email
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });

    // Always return success for security (don't reveal if email exists)
    // In production, you would send an email with a reset token here
    return res.status(200).json({
      message: "If an account with this email exists, a password reset link has been sent.",
    });

  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Error processing request",
      error: error.message,
    });
  }
};

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

export { changePassword, forgotPassword };
export default changePassword;