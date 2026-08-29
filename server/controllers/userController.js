import User from "../models/userModel.js";

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: {
        exclude: ["password"],
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User retrieved successfully",
      user,
    });

  } catch (error) {
    console.error("GET USER BY ID ERROR:", error);

    return res.status(500).json({
      message: "Server error while retrieving user",
      error: error.message,
    });
  }
};