import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const protect = async (req, res, next) => {
  try {
    console.log("AUTH MIDDLEWARE REACHED");

    const authHeader = req.headers.authorization;

    console.log("AUTH HEADER:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const token = authHeader.split(" ")[1];

    console.log("TOKEN RECEIVED:", token ? "YES" : "NO");

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findByPk(decoded.id, { attributes: ["id", "active"] });
    if (!user || !user.active) {
      return res.status(403).json({
        message: "This account has been deactivated. Please contact your administrator.",
      });
    }

    console.log("TOKEN VERIFIED:", decoded);

    req.user = decoded;

    next();

  } catch (error) {
    console.error("AUTH ERROR:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export default protect;