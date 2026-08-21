import bcrypt from "bcrypt";
import User from "../models/userModel.js";

const changePassword = async (req, res) => {
  try {
    const {
      email,
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    // 1. Check required fields
    if (
      !email ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // 2. Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New passwords do not match",
      });
    }

    // 3. Validate new password
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

    // 4. Find user
    const user = await User.findOne({
      where: {
        email: email.trim(),
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // 5. Verify current password
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    // 6. Hash new password
    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    // 7. Update user
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

export default changePassword;