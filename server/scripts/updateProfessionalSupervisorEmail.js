import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";

const updateEmail = async () => {
  try {
    await sequelize.authenticate();

    const supervisor = await User.findOne({ where: { role: "professional_supervisor" } });
    if (supervisor) {
      await supervisor.update({ email: "kapnang@gmail.com" });
      console.log("Updated professional supervisor email to kapnang@gmail.com");
      console.log("ID:", supervisor.id);
      console.log("Name:", supervisor.name);
    } else {
      console.log("No professional supervisor found");
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
};

updateEmail();
