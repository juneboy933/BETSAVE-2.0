import crypto from 'crypto';
import axios from 'axios';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import PartnerUser from '../database/models/partnerUser.model.js';

dotenv.config();

const KENYA_PHONE_REGEX = /^\+254\d{9}$/;

const normalizePhone = (phone) => String(phone || "").trim();
const resolveProviderUrl = () =>
    String(process.env.CRADLEVOICE_SMS_URL || process.env.CRADLEVOICE_URL || "").trim();
const toProviderPhone = (phone) => normalizePhone(phone).replace(/^\+/, "");

const isProviderFailure = (data) => {
    if (!data || typeof data !== "object") return false;
    if (typeof data.success === "boolean") return data.success === false;
    if (typeof data.status === "string") {
        const status = data.status.toUpperCase();
        return status === "FAILED" || status === "FAIL" || status === "ERROR";
    }
    return false;
};

const isProviderSuccess = (data) => {
    if (!data) return false;
    if (typeof data === "string") {
        return /(success|sent|queued|ok)/i.test(data);
    }
    if (typeof data !== "object") return false;
    if (typeof data.success === "boolean") return data.success === true;
    if (typeof data.status === "string") {
        const status = data.status.toUpperCase();
        if (status === "SUCCESS" || status === "SENT" || status === "QUEUED" || status === "OK") {
            return true;
        }
    }
    return Boolean(data.messageId || data.requestId || data.id);
};

const generateOTP = (length) => {
    const digits = "0123456789";
    let otp = "";

    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
        otp += digits[randomBytes[i] % 10];
    }

    return otp;
};

const storeOTP = async ({ partnerId, phone, otp }) => {
    const hashedOTP = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const partnerUser = await PartnerUser.findOneAndUpdate(
        { partnerId, phoneNumber: phone },
        {
            hashedOTP,
            otpExpiresAt: expiresAt,
            otpAttempts: 0
        },
        { new: true }
    );

    if (!partnerUser) {
        throw new Error("Partner user record not found for OTP storage");
    }

    return partnerUser;
};

export const sendOTP = async ({ partnerId, phone }) => {
    const normalizedPhone = normalizePhone(phone);
    const providerUrl = resolveProviderUrl();

    if (!partnerId) {
        return {
            success: false,
            code: "INVALID_PARTNER",
            error: "Partner identifier is required for OTP delivery"
        };
    }

    if (!KENYA_PHONE_REGEX.test(normalizedPhone)) {
        return {
            success: false,
            code: "INVALID_PHONE",
            error: "Invalid phone number format. Use +254XXXXXXXXX"
        };
    }

    if (!process.env.CRADLEVOICE_API_KEY || !providerUrl) {
        return {
            success: false,
            code: "OTP_PROVIDER_CONFIG_MISSING",
            error: "OTP provider credentials or URL are not configured"
        };
    }

    if (!/^https?:\/\//i.test(providerUrl)) {
        return {
            success: false,
            code: "OTP_PROVIDER_CONFIG_INVALID",
            error: "OTP provider URL is invalid"
        };
    }

    try {
        const otp = generateOTP(4);
        await storeOTP({ partnerId, phone: normalizedPhone, otp });
        const providerPhone = toProviderPhone(normalizedPhone);
    
        const payload = {
            token: process.env.CRADLEVOICE_API_KEY,
            message: `Your OTP code is ${otp}. It expires in 5 minutes.`,
            phone: [providerPhone]
        };
    
        const response = await axios.post(providerUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (isProviderFailure(response.data)) {
            return {
                success: false,
                code: "OTP_PROVIDER_REJECTED",
                error: "OTP provider rejected the request",
                providerResponse: response.data
            };
        }

        if (!isProviderSuccess(response.data)) {
            return {
                success: false,
                code: "OTP_PROVIDER_INVALID_RESPONSE",
                error: "OTP provider returned an unexpected response shape",
                providerResponse: response.data
            };
        }
    
        return {
            success: true,
            providerResponse: response.data
        };
    } catch (err){
        const providerResponse = err.response?.data;
        console.error("Error sending OTP:", providerResponse || err.message);
        const errorText = String(err.message || "").toLowerCase();
        if (errorText.includes("unrecognized name")) {
            return {
                success: false,
                code: "OTP_PROVIDER_TLS_SNI",
                error: "TLS/SNI mismatch with OTP provider host. Verify CRADLEVOICE_SMS_URL host and endpoint path.",
                providerResponse
            };
        }

        return {
            success: false,
            code: err.code === "ECONNABORTED" ? "OTP_PROVIDER_TIMEOUT" : "OTP_PROVIDER_ERROR",
            error: providerResponse?.message || err.message,
            providerResponse
        };
    }
};

export const verifyOTP = async ({ partnerId, phone, inputOTP }) => {
    const normalizedPhone = normalizePhone(phone);
    const otpValue = String(inputOTP || "").trim();
    const partnerUser = await PartnerUser.findOne({ partnerId, phoneNumber: normalizedPhone });

    if(!partnerUser || !partnerUser.hashedOTP) {
        throw new Error("OTP not found for this phone number");
    }

    if (!/^\d{4}$/.test(otpValue)) {
        throw new Error("Invalid OTP format");
    }

    if(new Date() > partnerUser.otpExpiresAt){
        throw new Error("OTP expired.");
    }

    if(partnerUser.otpAttempts >= 5){
        throw new Error("Too many OTP attempts. Please request a new OTP.");
    }

    const isMatch = await bcrypt.compare(otpValue, partnerUser.hashedOTP);

    if(!isMatch){
        partnerUser.otpAttempts += 1;
        await partnerUser.save();
        throw new Error("Invalid OTP. Please try again.");
    }

    // OTP is valid, reset attempts and return success
    partnerUser.hashedOTP = null;
    partnerUser.otpExpiresAt = null;
    partnerUser.otpAttempts = 0;
    await partnerUser.save();

    return {
        success: true,
        message: "OTP verified successfully.",
        partnerUser
    };
}

