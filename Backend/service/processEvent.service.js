import Event from "../database/models/event.model.js";
import { creditWallet } from "./creditWallet.service.js";

export const processEvent = async (eventId, partnerName) => {
    const event = await Event.findOneAndUpdate(
        { eventId, partnerName, status: 'RECEIVED' },
        { $set: { status: 'PROCESSING' } },
        { returnDocument: 'after' }
    );

    if (!event) return { status: 'FAILED', reason: 'Event not found or already processed' };

    try {
        if (!event.amount || event.amount <= 0) throw new Error('Invalid event amount');

        const savingspercentage = Number(process.env.SAVINGS_PERCENTAGE ?? 0.1);
        if (!Number.isFinite(savingspercentage) || savingspercentage <= 0 || savingspercentage > 1) {
            throw new Error('Invalid savings percentage configuration');
        }

        const savings = Math.round(event.amount * savingspercentage);

        await creditWallet({ userId: event.userId, eventId: event.eventId, amount: savings, reference: `${event.partnerName}_${event.type}` });

        await Event.findOneAndUpdate(
            { eventId, partnerName, status: 'PROCESSING' },
            { $set: { status: 'PROCESSED' } }
        );

        return { status: 'PROCESSED', savingsAmount: savings };

    } catch (error) {
        await Event.findOneAndUpdate(
            { eventId, partnerName, status: 'PROCESSING' },
            { $set: { status: 'FAILED' } }
        );
        console.error('Failed to process event:', error.message);
        return { status: 'FAILED', reason: error.message };
    }
};
