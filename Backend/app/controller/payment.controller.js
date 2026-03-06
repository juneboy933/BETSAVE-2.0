import mongoose from "mongoose";
import PaymentTransaction from "../../database/models/paymentTransaction.model.js";
import WithdrawalRequest from "../../database/models/withdrawalRequest.model.js";
import Event from "../../database/models/event.model.js";
import Partner from "../../database/models/partner.model.js";
import { webhookQueue } from "../../worker/queues.js";
import {
    isDarajaCollectionEnabled,
    isDarajaDisbursementEnabled,
    initiateB2C,
    initiateStkPush
} from "../../service/daraja.client.js";
import {
    confirmDeposit,
    failDeposit,
    initiateDeposit
} from "../../service/paymentCollection.service.js";
import {
    createWithdrawalRequest,
    markWithdrawalDisbursed,
    markWithdrawalFailed
} from "../../service/paymentWithdrawal.service.js";

const isSuccessStatus = (status) => {
    const normalized = String(status || "").trim().toUpperCase();
    return ["SUCCESS", "SUCCEEDED", "PROCESSED", "COMPLETED", "OK"].includes(normalized);
};

const normalizeOperatingMode = (value) => {
    const mode = String(value || "").trim().toLowerCase();
    if (mode === "live") return "live";
    if (mode === "demo") return "demo";
    return null;
};

const mapMetadataItems = (items) => {
    if (!Array.isArray(items)) {
        return {};
    }

    return items.reduce((acc, item) => {
        const key = String(item?.Name || "").trim();
        if (!key) return acc;
        acc[key] = item?.Value;
        return acc;
    }, {});
};

const parseDepositCallbackPayload = (payload) => {
    const stkCallback = payload?.Body?.stkCallback;

    if (stkCallback) {
        const metadata = mapMetadataItems(stkCallback?.CallbackMetadata?.Item);
        const resultCode = Number(stkCallback?.ResultCode);

        return {
            paymentTransactionId: payload?.paymentTransactionId || null,
            providerRequestId: stkCallback?.CheckoutRequestID || payload?.providerRequestId || null,
            providerTransactionId: metadata?.MpesaReceiptNumber || stkCallback?.MerchantRequestID || payload?.providerTransactionId || null,
            externalRef: metadata?.AccountReference || payload?.externalRef || null,
            status: Number.isFinite(resultCode) && resultCode === 0 ? "SUCCESS" : "FAILED",
            failureReason: stkCallback?.ResultDesc || payload?.failureReason || null,
            rawCallback: payload
        };
    }

    return {
        paymentTransactionId: payload?.paymentTransactionId || null,
        providerRequestId: payload?.providerRequestId || null,
        providerTransactionId: payload?.providerTransactionId || null,
        externalRef: payload?.externalRef || null,
        status: payload?.status || null,
        failureReason: payload?.failureReason || null,
        rawCallback: payload
    };
};

const parseWithdrawalCallbackPayload = (payload) => {
    const result = payload?.Result;

    if (result) {
        const resultCode = Number(result?.ResultCode);

        return {
            withdrawalRequestId: payload?.withdrawalRequestId || null,
            providerRequestId: result?.OriginatorConversationID || payload?.providerRequestId || null,
            providerTransactionId: result?.ConversationID || result?.TransactionID || payload?.providerTransactionId || null,
            externalRef: payload?.externalRef || null,
            status: Number.isFinite(resultCode) && resultCode === 0 ? "SUCCESS" : "FAILED",
            failureReason: result?.ResultDesc || payload?.failureReason || null,
            rawCallback: payload
        };
    }

    return {
        withdrawalRequestId: payload?.withdrawalRequestId || null,
        providerRequestId: payload?.providerRequestId || null,
        providerTransactionId: payload?.providerTransactionId || null,
        externalRef: payload?.externalRef || null,
        status: payload?.status || null,
        failureReason: payload?.failureReason || null,
        rawCallback: payload
    };
};

const assertCallbackAuth = (req, res) => {
    const expectedToken = String(process.env.PAYMENT_CALLBACK_TOKEN || "").trim();
    if (!expectedToken) {
        return true;
    }

    const providedToken = String(req.headers["x-callback-token"] || "").trim();
    if (providedToken !== expectedToken) {
        res.status(401).json({
            status: "FAILED",
            reason: "Unauthorized callback"
        });
        return false;
    }

    return true;
};

const resolveDepositTransactionId = async ({ paymentTransactionId, providerRequestId, providerTransactionId, externalRef }) => {
    if (mongoose.Types.ObjectId.isValid(paymentTransactionId)) {
        return paymentTransactionId;
    }

    const orConditions = [];
    if (providerRequestId) orConditions.push({ providerRequestId });
    if (providerTransactionId) orConditions.push({ providerTransactionId });
    if (externalRef) orConditions.push({ externalRef });

    if (orConditions.length === 0) {
        return null;
    }

    const paymentTransaction = await PaymentTransaction.findOne({
        type: "DEPOSIT",
        $or: orConditions
    }).select("_id");

    return paymentTransaction?._id ? String(paymentTransaction._id) : null;
};

const resolveWithdrawalRequestId = async ({ withdrawalRequestId, providerRequestId, providerTransactionId }) => {
    if (mongoose.Types.ObjectId.isValid(withdrawalRequestId)) {
        return withdrawalRequestId;
    }

    const orConditions = [];
    if (providerRequestId) orConditions.push({ providerRequestId });
    if (providerTransactionId) orConditions.push({ providerTransactionId });

    if (orConditions.length === 0) {
        return null;
    }

    const paymentTransaction = await PaymentTransaction.findOne({
        type: "WITHDRAWAL",
        $or: orConditions
    }).select("_id");

    if (!paymentTransaction?._id) {
        return null;
    }

    const withdrawalRequest = await WithdrawalRequest.findOne({
        paymentTransactionId: paymentTransaction._id
    }).select("_id");

    return withdrawalRequest?._id ? String(withdrawalRequest._id) : null;
};

const parseEventReference = (externalRef) => {
    const raw = String(externalRef || "").trim();
    if (!raw) {
        return null;
    }

    if (raw.startsWith("EVENT::")) {
        const parts = raw.split("::");
        if (parts.length >= 4) {
            const partnerName = String(parts[1] || "").trim();
            const operatingMode = normalizeOperatingMode(parts[2]);
            const eventId = String(parts.slice(3).join("::") || "").trim();
            if (partnerName && eventId && operatingMode) {
                return { partnerName, operatingMode, eventId };
            }
        }
        if (parts.length >= 3) {
            const partnerName = String(parts[1] || "").trim();
            const eventId = String(parts.slice(2).join("::") || "").trim();
            if (partnerName && eventId) {
                return { partnerName, eventId };
            }
        }
    }

    if (raw.startsWith("EVENT_")) {
        const eventId = String(raw.slice("EVENT_".length) || "").trim();
        if (eventId) {
            return { eventId };
        }
    }

    return null;
};

const resolvePartnerModeForDeposit = async ({ parsedExternalRef, paymentTransactionId }) => {
    const paymentTransaction = await PaymentTransaction.findById(paymentTransactionId)
        .select("externalRef userId")
        .lean();
    const eventRef = parseEventReference(parsedExternalRef || paymentTransaction?.externalRef);
    const externalRefMode = normalizeOperatingMode(eventRef?.operatingMode);

    if (eventRef?.eventId) {
        const eventQuery = { eventId: eventRef.eventId };
        if (eventRef.partnerName) {
            eventQuery.partnerName = eventRef.partnerName;
        }
        if (paymentTransaction?.userId) {
            eventQuery.userId = paymentTransaction.userId;
        }

        let matchedEvent = await Event.findOne(eventQuery)
            .sort({ createdAt: -1 })
            .select("partnerName operatingMode")
            .lean();

        if (!matchedEvent && paymentTransaction?.userId) {
            matchedEvent = await Event.findOne({ eventId: eventRef.eventId, userId: paymentTransaction.userId })
                .sort({ createdAt: -1 })
                .select("partnerName operatingMode")
                .lean();
        }

        if (!matchedEvent) {
            matchedEvent = await Event.findOne({ eventId: eventRef.eventId })
                .sort({ createdAt: -1 })
                .select("partnerName operatingMode")
                .lean();
        }

        const matchedMode = normalizeOperatingMode(matchedEvent?.operatingMode);
        if (matchedMode) {
            return matchedMode;
        }
    }

    if (externalRefMode) {
        return externalRefMode;
    }

    let partnerName = String(eventRef?.partnerName || "").trim();
    if (!partnerName && eventRef?.eventId) {
        const matchedEvent = await Event.findOne({ eventId: eventRef.eventId })
            .sort({ createdAt: -1 })
            .select("partnerName")
            .lean();
        partnerName = String(matchedEvent?.partnerName || "").trim();
    }

    if (!partnerName) {
        return "live";
    }

    const partner = await Partner.findOne({ name: partnerName })
        .select("operatingMode")
        .lean();
    return normalizeOperatingMode(partner?.operatingMode) || "demo";
};

const finalizeEventFromDepositTransaction = async ({ paymentTransaction, success, failureReason = null }) => {
    if (!paymentTransaction || paymentTransaction.type !== "DEPOSIT") {
        return null;
    }

    if (String(paymentTransaction.channel || "").toUpperCase() !== "STK") {
        return null;
    }

    const eventRef = parseEventReference(paymentTransaction.externalRef);
    if (!eventRef?.eventId) {
        return null;
    }

    const query = {
        eventId: eventRef.eventId,
        userId: paymentTransaction.userId,
        status: "PROCESSING"
    };

    if (eventRef.partnerName) {
        query.partnerName = eventRef.partnerName;
    }
    if (eventRef.operatingMode) {
        query.operatingMode = eventRef.operatingMode;
    }

    const nextStatus = success ? "PROCESSED" : "FAILED";
    const event = await Event.findOneAndUpdate(
        query,
        { $set: { status: nextStatus } },
        { returnDocument: "after" }
    ).lean();

    if (!event) {
        return null;
    }

    const result = success
        ? {
            status: "PROCESSED",
            savingsAmount: Number(paymentTransaction.amount) || 0,
            paymentStatus: paymentTransaction.status,
            paymentTransactionId: String(paymentTransaction._id)
        }
        : {
            status: "FAILED",
            reason: String(failureReason || paymentTransaction.failureReason || "STK payment failed"),
            paymentStatus: paymentTransaction.status,
            paymentTransactionId: String(paymentTransaction._id)
        };

    try {
        await webhookQueue.add("send-webhook", {
            eventId: event.eventId,
            partnerName: event.partnerName,
            result
        }, {
            jobId: `webhook-${event.partnerName}-${event.eventId}`,
            attempts: 5,
            backoff: { type: "exponential", delay: 10000 },
            removeOnComplete: true,
            removeOnFail: false
        });
    } catch (error) {
        console.error("Failed to enqueue callback webhook job:", error.message);
    }

    return event;
};

export const createDeposit = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const {
            phone = req.user?.phoneNumber,
            amount,
            channel = "STK",
            idempotencyKey,
            externalRef = null
        } = req.body || {};

        if (!idempotencyKey) {
            return res.status(400).json({
                status: "FAILED",
                reason: "idempotencyKey is required"
            });
        }

        const paymentTransaction = await initiateDeposit({
            userId,
            phone,
            amount,
            channel,
            idempotencyKey,
            externalRef
        });

        let providerAck = null;

        if (String(paymentTransaction.channel || "").toUpperCase() === "STK" && !paymentTransaction.providerRequestId && paymentTransaction.status === "INITIATED") {
            if (!isDarajaCollectionEnabled()) {
                await failDeposit({
                    paymentTransactionId: paymentTransaction._id,
                    failureReason: "Daraja collection configuration is missing"
                });
                return res.status(503).json({
                    status: "FAILED",
                    reason: "Daraja collection configuration is missing"
                });
            }

            const accountReference = paymentTransaction.externalRef || `BETSAVE_DEP_${paymentTransaction._id}`;
            providerAck = await initiateStkPush({
                phone: paymentTransaction.phone,
                amount: paymentTransaction.amount,
                accountReference,
                transactionDesc: "Betsave deposit"
            });

            paymentTransaction.status = "PENDING";
            paymentTransaction.providerRequestId = providerAck.checkoutRequestId || paymentTransaction.providerRequestId;
            paymentTransaction.providerTransactionId = providerAck.merchantRequestId || paymentTransaction.providerTransactionId;
            paymentTransaction.externalRef = accountReference;
            await paymentTransaction.save();
        }

        return res.status(201).json({
            status: "SUCCESS",
            paymentTransaction,
            providerAck
        });
    } catch (error) {
        return res.status(400).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const createWithdrawal = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const {
            phone = req.user?.phoneNumber,
            amount,
            idempotencyKey,
            notes = null
        } = req.body || {};

        if (!idempotencyKey) {
            return res.status(400).json({
                status: "FAILED",
                reason: "idempotencyKey is required"
            });
        }

        const { paymentTransaction, withdrawalRequest } = await createWithdrawalRequest({
            userId,
            phone,
            amount,
            idempotencyKey,
            notes
        });

        let providerAck = null;

        if (!paymentTransaction.providerRequestId && paymentTransaction.status === "PENDING") {
            if (!isDarajaDisbursementEnabled()) {
                await markWithdrawalFailed({
                    withdrawalRequestId: withdrawalRequest._id,
                    failureReason: "Daraja disbursement configuration is missing"
                });

                return res.status(503).json({
                    status: "FAILED",
                    reason: "Daraja disbursement configuration is missing"
                });
            }

            try {
                providerAck = await initiateB2C({
                    phone: paymentTransaction.phone,
                    amount: paymentTransaction.amount,
                    remarks: "Betsave withdrawal",
                    occasion: `BETSAVE_WD_${withdrawalRequest._id}`
                });

                paymentTransaction.providerRequestId = providerAck.originatorConversationId || paymentTransaction.providerRequestId;
                paymentTransaction.providerTransactionId = providerAck.conversationId || paymentTransaction.providerTransactionId;
                await paymentTransaction.save();
            } catch (error) {
                await markWithdrawalFailed({
                    withdrawalRequestId: withdrawalRequest._id,
                    failureReason: error.message
                });
                throw error;
            }
        }

        return res.status(201).json({
            status: "SUCCESS",
            paymentTransaction,
            withdrawalRequest,
            providerAck
        });
    } catch (error) {
        return res.status(400).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const handleDepositCallback = async (req, res) => {
    try {
        if (!assertCallbackAuth(req, res)) {
            return;
        }

        const parsed = parseDepositCallbackPayload(req.body || {});
        const resolvedPaymentTransactionId = await resolveDepositTransactionId(parsed);

        if (!mongoose.Types.ObjectId.isValid(resolvedPaymentTransactionId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Unable to resolve payment transaction id from callback"
            });
        }

        const callbackIsSuccess = isSuccessStatus(parsed.status);
        const partnerMode = await resolvePartnerModeForDeposit({
            parsedExternalRef: parsed.externalRef,
            paymentTransactionId: resolvedPaymentTransactionId
        });

        const paymentTransaction = callbackIsSuccess
            ? await confirmDeposit({
                paymentTransactionId: resolvedPaymentTransactionId,
                providerRequestId: parsed.providerRequestId,
                providerTransactionId: parsed.providerTransactionId,
                externalRef: parsed.externalRef,
                rawCallback: parsed.rawCallback,
                applyWalletCredit: partnerMode === "live"
            })
            : await failDeposit({
                paymentTransactionId: resolvedPaymentTransactionId,
                failureReason: parsed.failureReason,
                rawCallback: parsed.rawCallback
            });

        await finalizeEventFromDepositTransaction({
            paymentTransaction,
            success: callbackIsSuccess,
            failureReason: parsed.failureReason
        });

        return res.json({
            status: "SUCCESS",
            paymentTransaction
        });
    } catch (error) {
        return res.status(400).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const handleWithdrawalCallback = async (req, res) => {
    try {
        if (!assertCallbackAuth(req, res)) {
            return;
        }

        const parsed = parseWithdrawalCallbackPayload(req.body || {});
        const resolvedWithdrawalRequestId = await resolveWithdrawalRequestId(parsed);

        if (!mongoose.Types.ObjectId.isValid(resolvedWithdrawalRequestId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Unable to resolve withdrawal request id from callback"
            });
        }

        const { paymentTransaction, withdrawalRequest } = isSuccessStatus(parsed.status)
            ? await markWithdrawalDisbursed({
                withdrawalRequestId: resolvedWithdrawalRequestId,
                providerRequestId: parsed.providerRequestId,
                providerTransactionId: parsed.providerTransactionId,
                externalRef: parsed.externalRef,
                rawCallback: parsed.rawCallback
            })
            : await markWithdrawalFailed({
                withdrawalRequestId: resolvedWithdrawalRequestId,
                failureReason: parsed.failureReason,
                rawCallback: parsed.rawCallback
            });

        return res.json({
            status: "SUCCESS",
            paymentTransaction,
            withdrawalRequest
        });
    } catch (error) {
        return res.status(400).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getPaymentTransactionById = async (req, res) => {
    try {
        const { userId, paymentTransactionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(paymentTransactionId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid id"
            });
        }

        const paymentTransaction = await PaymentTransaction.findOne({
            _id: paymentTransactionId,
            userId
        }).lean();

        if (!paymentTransaction) {
            return res.status(404).json({
                status: "FAILED",
                reason: "Payment transaction not found"
            });
        }

        const withdrawalRequest = paymentTransaction.type === "WITHDRAWAL"
            ? await WithdrawalRequest.findOne({ paymentTransactionId }).lean()
            : null;

        return res.json({
            status: "SUCCESS",
            paymentTransaction,
            withdrawalRequest
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getUserPaymentTransactions = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const query = { userId };
        if (req.query.type) query.type = String(req.query.type).toUpperCase();
        if (req.query.status) query.status = String(req.query.status).toUpperCase();

        const [transactions, total] = await Promise.all([
            PaymentTransaction.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PaymentTransaction.countDocuments(query)
        ]);

        return res.json({
            status: "SUCCESS",
            page,
            limit,
            total,
            transactions
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};
