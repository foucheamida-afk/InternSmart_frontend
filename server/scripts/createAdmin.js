import bcrypt from "bcrypt";
import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";

const createAdmin = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const email = "foucheamida@gmail.com";
    const password = "dady12345";
    const name = "System Administrator";

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      console.log("Admin user already exists:", email);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      mustChangePassword: false,
    });

    console.log("Admin user created successfully!");
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("Role:", admin.role);
    console.log("ID:", admin.id);
  } catch (error) {
    console.error("Error creating admin:", error.message);
    process.exit(1);
  }
};

createAdmin();
