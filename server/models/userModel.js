import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  role: {
    type: DataTypes.ENUM(
      "student",
      "academic_supervisor",
      "professional",
      "admin"
    ),
    allowNull: false,
  },

  mustChangePassword: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
});

export default User;