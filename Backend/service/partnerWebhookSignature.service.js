const normalizePayloadBody = (payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return {};
    }

    return payload;
};

const normalizeMethod = (method = "POST") => String(method || "POST").trim().toUpperCase() || "POST";

export const buildPartnerWebhookRequestPath = (webhookUrl) => {
    const parsedUrl = new URL(String(webhookUrl || ""));
    return `${parsedUrl.pathname}${parsedUrl.search}`;
};

export const buildPartnerWebhookSignaturePayload = ({
    timestamp,
    method = "POST",
    webhookUrl,
    payload
}) => {
    const canonicalTimestamp = String(timestamp || "").trim();
    if (!canonicalTimestamp) {
        throw new Error("timestamp is required for partner webhook signing");
    }

    return `${canonicalTimestamp}${normalizeMethod(method)}${buildPartnerWebhookRequestPath(webhookUrl)}${JSON.stringify(normalizePayloadBody(payload))}`;
};
