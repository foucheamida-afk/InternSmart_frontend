import { sequelize } from "../config/db.js";
import User from "../models/userModel.js";

const fixSupervisor = async () => {
  try {
    await sequelize.authenticate();

    const supervisor = await User.findByPk(12);
    if (supervisor) {
      await supervisor.update({ email: "kapnang@gmail.com", role: "professional_supervisor" });
      console.log("Updated professional supervisor:");
      console.log("  ID:", supervisor.id);
      console.log("  Name:", supervisor.name);
      console.log("  Email: kapnang@gmail.com");
      console.log("  Role: professional_supervisor");
    } else {
      console.log("User not found");
    }
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
};

fixSupervisor();
