import crypto from "crypto";

export const hashPassword = (password, salt) =>
    crypto.scryptSync(password, salt, 64).toString("hex");

export const generateSalt = () => crypto.randomBytes(16).toString("hex");

export const generateAdminToken = () => crypto.randomBytes(48).toString("hex");

export const hashToken = (token) =>
    crypto.createHash("sha256").update(token).digest("hex");
