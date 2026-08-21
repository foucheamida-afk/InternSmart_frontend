import crypto from "crypto";

const generateTemporaryPassword = () => {
  return crypto.randomBytes(6).toString("base64url");
};

export default generateTemporaryPassword;