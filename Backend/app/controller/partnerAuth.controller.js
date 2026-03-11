import PartnerAuth from "../../database/models/partnerAuth.model.js";
import Partner from "../../database/models/partner.model.js";
import { hashPassword, generateSalt, generatePartnerJWT } from "../../service/partnerAuth.service.js";
import crypto from "crypto";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new partner with email and password.
 * Creates both Partner and PartnerAuth records.
 * Returns API credentials on success (shown once to user).
 */
export const registerPartnerAuth = async (req, res) => {
    try {
        const { name, email, password, webhookUrl, operatingMode } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();

        // validation
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

        if (password.length < 10) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Password must be at least 10 characters"
            });
        }

        // check if partner name/email already exists
        const existingPartner = await Partner.findOne({
            $or: [{ name: name.trim() }, { email: normalizedEmail }]
        });
        if (existingPartner) {
            return res.status(409).json({
                status: "FAILED",
                reason: "Partner name or email already exists"
            });
        }

        const existingAuth = await PartnerAuth.findOne({ email: normalizedEmail });
        if (existingAuth) {
            return res.status(409).json({
                status: "FAILED",
                reason: "Email already registered"
            });
        }

        // generate API credentials
        const apiKey = crypto.randomBytes(16).toString("hex");
        const apiSecret = crypto.randomBytes(32).toString("hex");

        // create partner record
        const partner = await Partner.create({
            name: name.trim(),
            email: normalizedEmail,
            apiKey,
            apiSecret,
            webhookUrl: webhookUrl?.trim() || null,
            operatingMode: operatingMode === "live" ? "live" : "demo",
            status: "ACTIVE"
        });

        // create partner auth record
        const passwordSalt = generateSalt();
        const passwordHash = hashPassword(password, passwordSalt);

        await PartnerAuth.create({
            partnerId: partner._id,
            email: normalizedEmail,
            passwordHash,
            passwordSalt,
            status: "ACTIVE"
        });

        // generate JWT for immediate dashboard access
        const token = generatePartnerJWT(partner._id, normalizedEmail, partner.name);

        // return API credentials (only once!)
        return res.status(201).json({
            status: "SUCCESS",
            partner: {
                id: partner._id,
                name: partner.name,
                email: normalizedEmail,
                operatingMode: partner.operatingMode
            },
            apiCredentials: {
                apiKey,
                apiSecret
            },
            token,
            securityNotice:
                "⚠️ Save your API Key and Secret now. We will not show them again. Store them securely on your backend for signing requests."
        });
    } catch (error) {
        console.error("registerPartnerAuth error:", error.message);
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

/**
 * Login partner with email and password.
 * Returns JWT token for dashboard access.
 */
export const loginPartnerAuth = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();

        if (!normalizedEmail || !password) {
            return res.status(400).json({
                status: "FAILED",
                reason: "email and password are required"
            });
        }

        // find partner auth record
        const partnerAuth = await PartnerAuth.findOne({ email: normalizedEmail })
            .populate("partnerId", "name email operatingMode status");

        if (!partnerAuth) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid credentials"
            });
        }

        if (partnerAuth.status !== "ACTIVE") {
            return res.status(403).json({
                status: "FAILED",
                reason: "Account is suspended"
            });
        }

        // verify password
        const passwordHash = hashPassword(password, partnerAuth.passwordSalt);
        if (passwordHash !== partnerAuth.passwordHash) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid credentials"
            });
        }

        // update last login
        partnerAuth.lastLoginAt = new Date();
        await partnerAuth.save();

        // generate JWT
        const token = generatePartnerJWT(
            partnerAuth.partnerId._id,
            normalizedEmail,
            partnerAuth.partnerId.name
        );

        return res.json({
            status: "SUCCESS",
            partner: {
                id: partnerAuth.partnerId._id,
                name: partnerAuth.partnerId.name,
                email: normalizedEmail,
                operatingMode: partnerAuth.partnerId.operatingMode || "demo"
            },
            token
        });
    } catch (error) {
        console.error("loginPartnerAuth error:", error.message);
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

/**
 * Refresh JWT token (optional but good practice).
 * Validates current token and issues a new one.
 */
export const refreshPartnerToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();

        if (!token) {
            return res.status(401).json({
                status: "FAILED",
                reason: "No token provided"
            });
        }

        let decoded;
        try {
            decoded = require("jsonwebtoken").verify(token, process.env.PARTNER_JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid or expired token"
            });
        }

        // regenerate token
        const newToken = generatePartnerJWT(decoded.partnerId, decoded.email, decoded.name);

        return res.json({
            status: "SUCCESS",
            token: newToken
        });
    } catch (error) {
        console.error("refreshPartnerToken error:", error.message);
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};
