import { registerPartner } from "../../service/registerPartner.service.js";
import { registerPartnerUser } from "../../service/registerPartnerUser.service.js";
import Partner from "../../database/models/partner.model.js";
import PartnerUser from "../../database/models/partnerUser.model.js";
import User from "../../database/models/user.model.js";
import { sendOTP, verifyOTP } from "../../service/otp.service.js";
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

        const { phone, autoSavingsEnabled } = req.body;
        const result = await registerPartnerUser({
            partner: req.partner,
            phone,
            autoSavingsEnabled
        });

        let otp = null;
        let otpProviderResponse = null;
        if (result.requiresOtp) {
            otp = await sendOTP({
                partnerId: req.partner.id,
                phone: result.phoneNumber
            });

            if (!otp.success) {
                const otpStatusCodeByCode = {
                    INVALID_PARTNER: 400,
                    INVALID_PHONE: 400,
                    OTP_PROVIDER_CONFIG_MISSING: 500,
                    OTP_PROVIDER_CONFIG_INVALID: 500,
                    OTP_PROVIDER_TIMEOUT: 504,
                    OTP_PROVIDER_REJECTED: 502,
                    OTP_PROVIDER_INVALID_RESPONSE: 502,
                    OTP_PROVIDER_TLS_SNI: 502,
                    OTP_PROVIDER_ERROR: 502
                };
                const otpStatusCode = otpStatusCodeByCode[otp.code] || 502;

                return res.status(otpStatusCode).json({
                    status: "FAILED",
                    reason: "User created but OTP delivery failed",
                    code: otp.code || "OTP_DELIVERY_FAILED",
                    details: otp.error,
                    providerHost: otp.providerHost || null,
                    tlsServername: otp.tlsServername || null,
                    providerHttpStatus: otp.providerHttpStatus || null,
                    providerStatusCode: otp.providerStatusCode || null,
                    providerResponse: otp.providerResponse || null
                });
            }
            otpProviderResponse = otp.providerResponse || null;
        }

        const structuredOtp = result.requiresOtp
            ? {
                required: true,
                requestAccepted: true,
                delivered: false,
                deliveryGuaranteed: false,
                message: "OTP request accepted by provider. Delivery to handset is asynchronous.",
                provider: otpProviderResponse
                    ? {
                        status: otpProviderResponse.status || null,
                        statusCode: otpProviderResponse.statusCode || null,
                        reason: otpProviderResponse.reason || null,
                        transactionId: otpProviderResponse.transactionId || null,
                        mobile: otpProviderResponse.mobile || null,
                        requestTime: otpProviderResponse.requestTime || null,
                        raw: otpProviderResponse
                    }
                    : null
            }
            : {
                required: false,
                requestAccepted: false,
                delivered: false,
                deliveryGuaranteed: false,
                message: "OTP not required because user is already verified.",
                provider: null
            };

        return res.status(201).json({
            status: "SUCCESS",
            ...result,
            otpSent: result.requiresOtp,
            otpProviderResponse,
            otp: structuredOtp
        });
    } catch (error) {
        const statusCode = error.message === "Invalid phone number" ? 400 : 500;
        return res.status(statusCode).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const verifyPartnerUserOtp = async (req, res) => {
    try {
        if (!req.partner) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Partner not authenticated"
            });
        }

        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({
                status: "FAILED",
                reason: "phone and otp are required"
            });
        }

        const normalizedPhone = phone.trim();
        await verifyOTP({
            partnerId: req.partner.id,
            phone: normalizedPhone,
            inputOTP: String(otp).trim()
        });

        const [partnerUser, user] = await Promise.all([
            PartnerUser.findOneAndUpdate(
                { partnerId: req.partner.id, phoneNumber: normalizedPhone },
                { $set: { status: "VERIFIED" } },
                { returnDocument: "after" }
            ),
            User.findOneAndUpdate(
                { phoneNumber: normalizedPhone },
                { $set: { verified: true, status: "ACTIVE" } },
                { returnDocument: "after" }
            )
        ]);

        return res.json({
            status: "SUCCESS",
            message: "OTP verified successfully",
            partnerUser: partnerUser
                ? {
                    id: partnerUser._id,
                    phoneNumber: partnerUser.phoneNumber,
                    status: partnerUser.status,
                    autoSavingsEnabled: !!partnerUser.autoSavingsEnabled
                }
                : null,
            user: user
                ? {
                    id: user._id,
                    phoneNumber: user.phoneNumber,
                    verified: user.verified,
                    status: user.status
                }
                : null
        });
    } catch (error) {
        const knownErrors = new Set([
            "OTP not found for this phone number",
            "Invalid OTP format",
            "OTP expired.",
            "Too many OTP attempts. Please request a new OTP.",
            "Invalid OTP. Please try again."
        ]);

        return res.status(knownErrors.has(error.message) ? 400 : 500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};
