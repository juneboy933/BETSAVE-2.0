import Event from "../database/models/event.model.js";
import Partner from "../database/models/partner.model.js";
import PartnerUser from "../database/models/partnerUser.model.js";
import User from "../database/models/user.model.js";

export const ingestEvent = async (incomingEvent) => {
    const { eventId, phone, partnerName, type = "BET_PLACED", amount } = incomingEvent;

    // Idempotency check
    const existing = await Event.findOne({ eventId, partnerName });
    if (existing) {
        return { status: "SKIPPED", reason: "Event already processed" };
    }

    // Find user
    const user = await User.findOne({ phoneNumber: phone });

     // Add !user.verified later when we verify via safaricom
    if (!user) {
        await Event.create({
            eventId,
            userId: null,
            type,
            phone,
            partnerName,
            amount,
            status: "FAILED"
        });

        return { status: "FAILED", reason: "User not found or not verified" };
    }

    // Record event as RECEIVED
    const createdEvent = await Event.create({
        eventId,
        userId: user._id,
        phone,
        partnerName,
        type,
        amount,
        status: "RECEIVED"
    });

    const partner = await Partner.findOne({ name: partnerName }).select("_id name");
    if (partner) {
        await PartnerUser.findOneAndUpdate(
            { partnerId: partner._id, userId: user._id },
            {
                $setOnInsert: {
                    partnerId: partner._id,
                    partnerName: partner.name,
                    userId: user._id,
                    phoneNumber: phone,
                    source: "INFERRED",
                    status: "ACTIVE"
                }
            },
            { upsert: true }
        );
    }

    return {
        status: "RECEIVED",
        event: createdEvent
    };
};
