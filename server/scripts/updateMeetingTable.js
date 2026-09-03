import { sequelize } from "../config/db.js";
import { DataTypes } from "sequelize";

const updateMeetingTable = async () => {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable("Meetings");

    if (!columns.studentIds) {
      await queryInterface.addColumn("Meetings", "studentIds", {
        type: DataTypes.JSON,
        allowNull: true,
      });
      console.log("Added Meetings.studentIds column");
    }

    if (!columns.isGroupMeeting) {
      await queryInterface.addColumn("Meetings", "isGroupMeeting", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      console.log("Added Meetings.isGroupMeeting column");
    }

    console.log("Meeting table updated successfully");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    process.exit(0);
  }
};

updateMeetingTable();
