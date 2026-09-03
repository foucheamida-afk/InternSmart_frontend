import { sequelize } from "../config/db.js";
import { DataTypes } from "sequelize";

const updateInternshipTable = async () => {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.changeColumn("Internships", "academicSupervisorId", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    console.log("Updated Internships.academicSupervisorId to allow null");

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
};

updateInternshipTable();
