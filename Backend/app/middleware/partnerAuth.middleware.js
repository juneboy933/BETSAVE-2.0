import crypto from "crypto";
import Partner from "../../database/models/partner.model.js";

const SAFE_TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const normalizeBody = (body) => {
    if (!body || typeof body !== "object") return {};
    return Object.keys(body).length ? body : {};
};

const normalizePath = (url) => `/${String(url || "").replace(/^\/+/, "")}`;

export const verifyPartner = async (req, res, next) => {
    try {
        const apiKey = req.headers["x-api-key"];
        const signature = req.headers["x-signature"];
        const timestamp = req.headers["x-timestamp"];

        if (!apiKey || !signature || !timestamp) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Missing authentication headers"
            });
        }

        // Prevent replay attacks
        const now = Date.now();
        const requestTime = Number(timestamp);
        if (!Number.isFinite(requestTime)) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid timestamp"
            });
        }

        if (Math.abs(now - requestTime) > SAFE_TIME_WINDOW_MS) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Request expired"
            });
        }

        const partner = await Partner.findOne({ apiKey });

        if (!partner) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid API Key"
            });
        }

        if (partner.status !== "ACTIVE") {
            return res.status(403).json({
                status: "FAILED",
                reason: "Partner not active"
            });
        }

        const canonicalBody = normalizeBody(req.body);
        const canonicalPath = normalizePath(req.originalUrl);
        const payload = `${timestamp}${req.method.toUpperCase()}${canonicalPath}${JSON.stringify(canonicalBody)}`;

        const expectedSignature = crypto
            .createHmac("sha256", partner.apiSecret)
            .update(payload)
            .digest("hex");

        if (!/^[a-f0-9]{64}$/i.test(signature)) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid signature format"
            });
        }

        const expectedBuffer = Buffer.from(expectedSignature, "hex");
        const incomingBuffer = Buffer.from(signature, "hex");

        if (
            expectedBuffer.length !== incomingBuffer.length ||
            !crypto.timingSafeEqual(expectedBuffer, incomingBuffer)
        ) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid signature"
            });
        }

        req.partner = {
            id: partner._id,
            name: partner.name,
        };

        next();
    } catch (error) {
        console.error("verifyPartner error:", error.message);

        return res.status(500).json({
            status: "FAILED",
            reason: "Partner verification failed"
        });
    }
};
