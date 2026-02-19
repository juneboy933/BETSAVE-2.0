import { registerPartner } from "../../service/registerPartner.service.js";
import { registerPartnerUser } from "../../service/registerPartnerUser.service.js";
import Partner from "../../database/models/partner.model.js";
import crypto from "crypto";

const CREDENTIALS_SECURITY_NOTICE =
    "Store your API key and API secret securely in your backend secret manager. Do not expose them in client-side code.";

export const createPartner = async (req, res) => {
    try {
        const { name, webhookUrl } = req.body;

        if(!name || !webhookUrl){
            return res.status(400).json({
                status: 'FAILED',
                reason: 'Name or webhook URL not provided.' 
            });
        }

        const partner = await registerPartner({name, webhookUrl});

        return res.status(201).json({
            status: 'SUCCESS',
            partner,
            securityNotice: CREDENTIALS_SECURITY_NOTICE
        });

    } catch (error) {
        return res.status(400).json({
            status: 'FAILED',
            reason: error.message
        });
    }
};

export const loginPartner = async (req, res) => {
    try {
        const { apiKey, apiSecret } = req.body;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({
                status: "FAILED",
                reason: "apiKey and apiSecret are required"
            });
        }

        const partner = await Partner.findOne({ apiKey }).select("_id name apiKey apiSecret status webhookUrl");
        if (!partner) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid credentials"
            });
        }

        if (partner.status !== "ACTIVE") {
            return res.status(403).json({
                status: "FAILED",
                reason: "Partner is suspended"
            });
        }

        const expected = Buffer.from(partner.apiSecret, "utf8");
        const provided = Buffer.from(apiSecret, "utf8");
        const valid =
            expected.length === provided.length &&
            crypto.timingSafeEqual(expected, provided);

        if (!valid) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid credentials"
            });
        }

        return res.json({
            status: "SUCCESS",
            partner: {
                id: partner._id,
                name: partner.name,
                apiKey: partner.apiKey,
                webhookUrl: partner.webhookUrl,
                status: partner.status
            },
            securityNotice: CREDENTIALS_SECURITY_NOTICE
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getPartnerCredentials = async (req, res) => {
    try {
        if (!req.partner?.id) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Partner not authenticated"
            });
        }

        const partner = await Partner.findById(req.partner.id)
            .select("_id name apiKey apiSecret status");

        if (!partner) {
            return res.status(404).json({
                status: "FAILED",
                reason: "Partner not found"
            });
        }

        if (partner.status !== "ACTIVE") {
            return res.status(403).json({
                status: "FAILED",
                reason: "Partner is suspended"
            });
        }

        return res.json({
            status: "SUCCESS",
            credentials: {
                apiKey: partner.apiKey,
                apiSecret: partner.apiSecret
            },
            securityNotice: CREDENTIALS_SECURITY_NOTICE
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const registerUserFromPartner = async (req, res) => {
    try {
        if (!req.partner) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Partner not authenticated"
            });
        }

        const { phone } = req.body;
        const result = await registerPartnerUser({
            partner: req.partner,
            phone
        });

        return res.status(201).json({
            status: "SUCCESS",
            ...result
        });
    } catch (error) {
        const statusCode = error.message === "Invalid phone number" ? 400 : 500;
        return res.status(statusCode).json({
            status: "FAILED",
            reason: error.message
        });
    }
};
