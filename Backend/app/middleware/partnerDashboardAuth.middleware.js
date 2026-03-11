import jwt from "jsonwebtoken";
import Partner from "../../database/models/partner.model.js";
import env from "../config.js";
import { verifyPartner } from "./partnerAuth.middleware.js";

/**
 * Authenticate partner dashboard requests.  Allows either:
 *  - Bearer token issued by loginPartner (expires, no secret exposure)
 *  - Legacy signed request using apiKey/apiSecret (for backwards compatibility)
 *
 * Dashboard routes use this middleware instead of verifyPartner directly.
 */
export const verifyPartnerDashboard = async (req, res, next) => {
    // check for Bearer token first
    const auth = req.headers.authorization || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
        const token = auth.slice(7).trim();
        try {
            const payload = jwt.verify(token, env.PARTNER_JWT_SECRET);
            // ensure partner still active
            const partner = await Partner.findById(payload.partnerId).select("name status operatingMode");
            if (!partner || partner.status !== "ACTIVE") {
                return res.status(403).json({ status: "FAILED", reason: "Partner not active" });
            }
            req.partner = {
                id: partner._id,
                name: partner.name,
                operatingMode: partner.operatingMode || "demo"
            };
            return next();
        } catch (err) {
            console.error("partner dashboard token error", err.message);
            return res.status(401).json({ status: "FAILED", reason: "Invalid or expired token" });
        }
    }
    // fall back to signature-based authentication
    return verifyPartner(req, res, next);
};
