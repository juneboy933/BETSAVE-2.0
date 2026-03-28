import Event from "../database/models/event.model.js";
import Partner from "../database/models/partner.model.js";
import PartnerUser from "../database/models/partnerUser.model.js";
import User from "../database/models/user.model.js";

const isDuplicateKeyError = (error) => error?.code === 11000;

const createEventSafely = async (payload) => {
    try {
        return await Event.create(payload);
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return null;
        }
        throw error;
    }
};

export const ingestEvent = async (incomingEvent) => {
    const { eventId, phone, partnerName, type = "BET_PLACED", amount } = incomingEvent;

    const partner = await Partner.findOne({ name: partnerName }).select("_id name operatingMode");
    if (!partner) {
        await createEventSafely({
            eventId,
            userId: null,
            type,
            phone,
            partnerName,
            operatingMode: "demo",
            amount,
            status: "FAILED"
        });

        return { status: "FAILED", reason: "Partner not found" };
    }

    const eventMode = String(partner.operatingMode || "demo").trim().toLowerCase() === "live"
        ? "live"
        : "demo";

    const existing = await Event.findOne({ eventId, partnerName, operatingMode: eventMode });
    if (existing) {
        return { status: "SKIPPED", reason: "Event already processed" };
    }

    // Find user
    const user = await User.findOne({ phoneNumber: phone });
    if (!user || !user.verified) {
        const createdEvent = await createEventSafely({
            eventId,
            userId: user?._id || null,
            type,
            phone,
            partnerName,
            operatingMode: eventMode,
            amount,
            status: "FAILED"
        });

        if (!createdEvent) {
            return { status: "SKIPPED", reason: "Event already processed" };
        }

        return { status: "FAILED", reason: "User not found or not verified" };
    }

    const partnerUser = await PartnerUser.findOne({ partnerId: partner._id, userId: user._id });
    if (!partnerUser) {
        const createdEvent = await createEventSafely({
            eventId,
            userId: user._id,
            type,
            phone,
            partnerName,
            operatingMode: eventMode,
            amount,
            status: "FAILED"
        });

        if (!createdEvent) {
            return { status: "SKIPPED", reason: "Event already processed" };
        }

        return { status: "FAILED", reason: "User is not linked to this partner" };
    }

    if (partnerUser.status !== "VERIFIED" && partnerUser.status !== "ACTIVE") {
        const createdEvent = await createEventSafely({
            eventId,
            userId: user._id,
            type,
            phone,
            partnerName,
            operatingMode: eventMode,
            amount,
            status: "FAILED"
        });

        if (!createdEvent) {
            return { status: "SKIPPED", reason: "Event already processed" };
        }

        return { status: "FAILED", reason: "User is pending verification for this partner" };
    }

    if (!partnerUser.autoSavingsEnabled) {
        const createdEvent = await createEventSafely({
            eventId,
            userId: user._id,
            type,
            phone,
            partnerName,
            operatingMode: eventMode,
            amount,
            status: "FAILED"
        });

        if (!createdEvent) {
            return { status: "SKIPPED", reason: "Event already processed" };
        }

        return { status: "FAILED", reason: "Auto-savings is not enabled for this user" };
    }

    // Record event as RECEIVED
    const createdEvent = await createEventSafely({
        eventId,
        userId: user._id,
        phone,
        partnerName,
        operatingMode: eventMode,
        type,
        amount,
        status: "RECEIVED"
    });

    if (!createdEvent) {
        return { status: "SKIPPED", reason: "Event already processed" };
    }

    return {
        status: "RECEIVED",
        event: createdEvent
    };
};
