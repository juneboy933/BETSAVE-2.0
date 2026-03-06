import Event from "../database/models/event.model.js";
import Partner from "../database/models/partner.model.js";
import { initiateDeposit } from "./paymentCollection.service.js";
import { initiateStkPush, isDarajaCollectionEnabled } from "./daraja.client.js";
import dotenv from "dotenv";

dotenv.config();

const normalizeOperatingMode = (value) => {
    const mode = String(value || "").trim().toLowerCase();
    if (mode === "live") return "live";
    if (mode === "demo") return "demo";
    return null;
};

const getPartnerOperatingMode = async (partnerName) => {
    const partner = await Partner.findOne({ name: partnerName }).select("operatingMode").lean();
    return normalizeOperatingMode(partner?.operatingMode) || "demo";
};

const buildEventStkIdempotencyKey = ({ partnerName, eventId, userId }) =>
    `event-stk::${partnerName}::${eventId}::${String(userId)}`;

const buildEventExternalRef = ({ partnerName, operatingMode, eventId }) =>
    `EVENT::${partnerName}::${operatingMode}::${eventId}`;

export const processEvent = async (eventId, partnerName, requestedOperatingMode = null) => {
    const requestedMode = normalizeOperatingMode(requestedOperatingMode);
    const eventQuery = {
        eventId,
        partnerName,
        status: 'RECEIVED'
    };
    if (requestedMode) {
        eventQuery.operatingMode = requestedMode;
    }

    const event = await Event.findOneAndUpdate(
        eventQuery,
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
        if (!Number.isFinite(savings) || savings <= 0) {
            throw new Error("Computed savings amount is invalid");
        }

        let operatingMode = normalizeOperatingMode(event.operatingMode);
        if (!operatingMode) {
            operatingMode = await getPartnerOperatingMode(partnerName);
            await Event.findByIdAndUpdate(event._id, { $set: { operatingMode } });
        }
        if (!operatingMode) {
            throw new Error("Unsupported event operating mode for event-driven STK processing");
        }

        if (!isDarajaCollectionEnabled()) {
            throw new Error("Daraja collection is not configured for event-driven STK processing");
        }

        const idempotencyKey = buildEventStkIdempotencyKey({
            partnerName,
            eventId: event.eventId,
            userId: event.userId
        });
        const externalRef = buildEventExternalRef({
            partnerName,
            operatingMode,
            eventId: event.eventId
        });
        const paymentTransaction = await initiateDeposit({
            userId: event.userId,
            phone: event.phone,
            amount: savings,
            channel: "STK",
            idempotencyKey,
            externalRef
        });

        if (!paymentTransaction.providerRequestId && paymentTransaction.status === "INITIATED") {
            const providerAck = await initiateStkPush({
                phone: paymentTransaction.phone,
                amount: paymentTransaction.amount,
                accountReference: paymentTransaction.externalRef || externalRef,
                transactionDesc: `Savings collection for event ${event.eventId}`
            });

            paymentTransaction.status = "PENDING";
            paymentTransaction.providerRequestId =
                providerAck.checkoutRequestId || paymentTransaction.providerRequestId;
            paymentTransaction.providerTransactionId =
                providerAck.merchantRequestId || paymentTransaction.providerTransactionId;
            await paymentTransaction.save();
        }

        return {
            status: "PENDING",
            savingsAmount: Number(paymentTransaction.amount) || savings,
            paymentStatus: paymentTransaction.status,
            paymentTransactionId: String(paymentTransaction._id),
            notifyPartner: false
        };

    } catch (error) {
        await Event.findOneAndUpdate(
            { eventId, partnerName, status: 'PROCESSING' },
            { $set: { status: 'FAILED' } }
        );
        console.error('Failed to process event:', error.message);
        return { status: 'FAILED', reason: error.message, notifyPartner: true };
    }
};
