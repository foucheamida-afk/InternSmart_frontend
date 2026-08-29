import jwt from "jsonwebtoken";

const protect = (req, res, next) => {
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