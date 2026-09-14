import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Purpose-scoped tokens (password reset) are signed with a derived secret and
    // are not access tokens. Reject them explicitly as a second line of defence.
    if (decoded.purpose) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const user = await User.findByPk(decoded.id, { attributes: ["id", "active", "role"] });
    if (!user || user.active === false) {
      return res.status(403).json({
        message: "This account has been deactivated. Please contact your administrator.",
      });
    }

    req.user = { ...decoded, role: user.role };

    next();

  } catch (error) {
    console.error("AUTH ERROR:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export default protect;