import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";

const debugUsers = async () => {
  try {
    await sequelize.authenticate();

    const users = await User.findAll({ attributes: ["id", "name", "email", "role"] });
    console.log("All users in database:");
    for (const u of users) {
      console.log(`  ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`);
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
};

debugUsers();
