import crypto from "crypto";
import Admin from "../../database/models/admin.model.js";
import { hashToken } from "../../service/adminAuth.service.js";

export const verifyAdmin = async (req, res, next) => {
    const configuredToken = process.env.ADMIN_DASHBOARD_TOKEN;
    const incomingToken = req.headers["x-admin-token"];

    if (!incomingToken || typeof incomingToken !== "string") {
        return res.status(401).json({
            status: "FAILED",
            reason: "Missing admin token"
        });
    }

    if (configuredToken) {
        const expected = Buffer.from(configuredToken, "utf8");
        const provided = Buffer.from(incomingToken, "utf8");

        if (
            expected.length === provided.length &&
            crypto.timingSafeEqual(expected, provided)
        ) {
            req.admin = { source: "ENV_TOKEN" };
            return next();
        }
    }

    try {
        const apiTokenHash = hashToken(incomingToken);
        const admin = await Admin.findOne({ apiTokenHash, status: "ACTIVE" }).select("name email");
        if (!admin) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid admin token"
            });
        }

        req.admin = {
            source: "DB_TOKEN",
            name: admin.name,
            email: admin.email
        };

        return next();
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: "Admin verification failed"
        });
    }
};
