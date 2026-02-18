import Admin from "../../database/models/admin.model.js";
import {
    generateAdminToken,
    generateSalt,
    hashPassword,
    hashToken
} from "../../service/adminAuth.service.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();

        if (!name?.trim() || !normalizedEmail || !password) {
            return res.status(400).json({
                status: "FAILED",
                reason: "name, email and password are required"
            });
        }

        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid email format"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Password must be at least 8 characters"
            });
        }

        const existing = await Admin.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(409).json({
                status: "FAILED",
                reason: "Admin already exists"
            });
        }

        const passwordSalt = generateSalt();
        const passwordHash = hashPassword(password, passwordSalt);
        const adminToken = generateAdminToken();
        const apiTokenHash = hashToken(adminToken);

        const admin = await Admin.create({
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
            passwordSalt,
            apiTokenHash,
            apiTokenIssuedAt: new Date(),
            lastLoginAt: new Date(),
            status: "ACTIVE"
        });

        return res.status(201).json({
            status: "SUCCESS",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email
            },
            token: adminToken
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();

        if (!normalizedEmail || !password) {
            return res.status(400).json({
                status: "FAILED",
                reason: "email and password are required"
            });
        }

        const admin = await Admin.findOne({ email: normalizedEmail });
        if (!admin) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid credentials"
            });
        }

        if (admin.status !== "ACTIVE") {
            return res.status(403).json({
                status: "FAILED",
                reason: "Admin account is suspended"
            });
        }

        const passwordHash = hashPassword(password, admin.passwordSalt);
        if (passwordHash !== admin.passwordHash) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid credentials"
            });
        }

        const adminToken = generateAdminToken();
        admin.apiTokenHash = hashToken(adminToken);
        admin.apiTokenIssuedAt = new Date();
        admin.lastLoginAt = new Date();
        await admin.save();

        return res.json({
            status: "SUCCESS",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email
            },
            token: adminToken
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};
