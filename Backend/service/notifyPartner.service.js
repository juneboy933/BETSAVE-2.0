import Partner from '../database/models/partner.model.js';
import crypto from 'crypto';
import axios from 'axios';

export const sendpartnerWebhook = async ({ partnerName, payload }) => {
    try {
        const partner = await Partner.findOne({ name: partnerName });
        if (!partner?.webhookUrl) return console.warn(`No webhook configured for partner ${partnerName}`);

        const timestamp = Date.now().toString();
        const signaturePayload = `${timestamp}${JSON.stringify(payload)}`;
        const signature = crypto.createHmac("sha256", partner.apiSecret).update(signaturePayload).digest('hex');

        await axios.post(partner.webhookUrl, payload, {
            headers: {
                "Content-Type": "application/json",
                "x-timestamp": timestamp,
                "x-signature": signature,
                "x-api-key": partner.apiKey
            },
            timeout: 5000
        });

        console.log(`Webhook sent to ${partner.name} successfully`);

    } catch (error) {
        console.error(`Webhook failed for partner ${partnerName}:`, error.message);
    }
};