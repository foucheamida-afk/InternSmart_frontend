import { sequelize } from "../config/db.js";
import { DataTypes } from "sequelize";

const updateTaskTable = async () => {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable("Tasks");

    const missingColumns = {
      feedbackAcademic: { type: DataTypes.TEXT, allowNull: true },
      feedbackAcademicAt: { type: DataTypes.DATE, allowNull: true },
      feedbackAcademicBy: { type: DataTypes.INTEGER, allowNull: true },
      feedbackProfessional: { type: DataTypes.TEXT, allowNull: true },
      feedbackProfessionalAt: { type: DataTypes.DATE, allowNull: true },
      feedbackProfessionalBy: { type: DataTypes.INTEGER, allowNull: true },
    };

    for (const [name, definition] of Object.entries(missingColumns)) {
      if (!columns[name]) {
        await queryInterface.addColumn("Tasks", name, definition);
        console.log(`Added Tasks.${name} column`);
      }
    }

    console.log("Task table updated successfully");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
};

updateTaskTable();
