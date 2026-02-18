import Partner from "../database/models/partner.model.js"
import { generatePartnerCredential } from "./generatePartnerCredentials.service.js";

export const registerPartner = async({ name, webhookUrl }) => {
    const existing = await Partner.findOne({ name });
    if(existing){
        throw new Error('Partner already exists.');
    }

    const { apiKey, apiSecret } = generatePartnerCredential(name);
    const partner = await Partner.create({
        name,
        apiKey,
        apiSecret,
        status: 'ACTIVE',
        webhookUrl
    });

    return {
        id: partner._id,
        name: partner.name,
        apiKey,
        apiSecret,
        webhookUrl: partner.webhookUrl
    };
};