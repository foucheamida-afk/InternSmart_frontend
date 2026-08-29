import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/generatejwt.js";

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // 1. Check required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // 2. Clean email
    const cleanEmail = email.trim().toLowerCase();

    // 3. Find user
    const user = await User.findOne({
      where: {
        email: cleanEmail,
      },
    });

    // 4. User doesn't exist
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.active) {
      return res.status(403).json({
        message: "This account has been deactivated. Please contact your administrator.",
      });
    }

    // 5. Compare password with bcrypt hash
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    // 6. Password doesn't match
    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // 7. Generate JWT
    const token = generateToken(user);

    // 8. Successful login
    return res.status(200).json({
      message: "Login successful",

      token,

      requiresPasswordChange: Boolean(
        user.mustChangePassword
      ),

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
      message: "Server error during login",
      error: error.message,
    });
  }
};

export default login;
