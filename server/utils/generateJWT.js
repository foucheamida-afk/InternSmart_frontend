import jwt from "jsonwebtoken";

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || "internsmart_super_secret_key_2026";
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    secret,
    {
      expiresIn: "1d",
    }
  );
};

export default generateToken;