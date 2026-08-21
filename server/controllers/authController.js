import User from "../models/userModel.js";
import bcrypt from "bcrypt";

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      where: {
        email: email.trim(),
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.mustChangePassword) {
      return res.status(200).json({
        message: "Login successful. Password change required.",
        requiresPasswordChange: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    return res.status(200).json({
      message: "Login successful",
      requiresPasswordChange: false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

export default login;