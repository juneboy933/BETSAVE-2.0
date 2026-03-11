import crypto from "crypto";
import jwt from "jsonwebtoken";
import env from "../app/config.js";

const HASH_ALGORITHM = "sha256";
const HASH_KEY_LENGTH = 32;

export const generateSalt = () => crypto.randomBytes(16).toString("hex");

export const hashPassword = (password, salt) => {
    return crypto
        .pbkdf2Sync(password, salt, 100000, HASH_KEY_LENGTH, HASH_ALGORITHM)
        .toString("hex");
};

export const generatePartnerJWT = (partnerId, email, partnerName) => {
    return jwt.sign(
        {
            partnerId: partnerId.toString(),
            email,
            name: partnerName
        },
        env.PARTNER_JWT_SECRET,
        { expiresIn: "8h" }
    );
};

export const verifyPartnerJWT = (token) => {
    try {
        return jwt.verify(token, env.PARTNER_JWT_SECRET);
    } catch (err) {
        return null;
    }
};
