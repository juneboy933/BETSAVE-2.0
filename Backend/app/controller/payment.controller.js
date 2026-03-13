import mongoose from "mongoose";
import PaymentTransaction from "../../database/models/paymentTransaction.model.js";
import WithdrawalRequest from "../../database/models/withdrawalRequest.model.js";
import Event from "../../database/models/event.model.js";
import Partner from "../../database/models/partner.model.js";
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
import {
    normalizeOperatingMode,
    parseEventReference
} from "../../service/eventReference.service.js";
import { finalizeEvent } from "../../service/eventFinalization.service.js";
import {
    buildSignedCallbackUrl,
    verifySignedCallbackToken
} from "../../service/paymentCallbackSecurity.service.js";
import {
    ensureCallbackResourceBinding,
    parseDepositCallbackPayload,
    parseWithdrawalCallbackPayload,
    validateDepositSettlement,
    validateWithdrawalSettlement
} from "../../service/paymentCallbackValidation.service.js";

const isSuccessStatus = (status) => {
    const normalized = String(status || "").trim().toUpperCase();
    return ["SUCCESS", "SUCCEEDED", "PROCESSED", "COMPLETED", "OK"].includes(normalized);
};

const getSignedCallbackResourceId = ({ req, res, callbackType, resourceParamName }) => {
    const resourceId = String(req.query?.[resourceParamName] || "").trim();
    const providedToken = String(req.query?.callbackToken || "").trim();
    const providedCallbackType = String(req.query?.callbackType || "")
        .trim()
        .toLowerCase();

    if (
        !resourceId ||
        !providedToken ||
        (providedCallbackType && providedCallbackType !== callbackType) ||
        !verifySignedCallbackToken({ callbackType, resourceId, providedToken })
    ) {
        res.status(401).json({
            status: "FAILED",
            reason: "Unauthorized callback"
        });
        return null;
    }

    return resourceId;
};

const resolveDepositTransactionId = async ({
    paymentTransactionId,
    providerRequestId,
    providerTransactionId,
    externalRef,
    paymentTransactionModel = PaymentTransaction
}) => {
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

    const paymentTransaction = await paymentTransactionModel.findOne({
        type: "DEPOSIT",
        $or: orConditions
    }).select("_id");

    return paymentTransaction?._id ? String(paymentTransaction._id) : null;
};

const resolveWithdrawalRequestId = async ({
    withdrawalRequestId,
    providerRequestId,
    providerTransactionId,
    paymentTransactionModel = PaymentTransaction,
    withdrawalRequestModel = WithdrawalRequest
}) => {
    if (mongoose.Types.ObjectId.isValid(withdrawalRequestId)) {
        return withdrawalRequestId;
    }

    const orConditions = [];
    if (providerRequestId) orConditions.push({ providerRequestId });
    if (providerTransactionId) orConditions.push({ providerTransactionId });

    if (orConditions.length === 0) {
        return null;
    }

    const paymentTransaction = await paymentTransactionModel.findOne({
        type: "WITHDRAWAL",
        $or: orConditions
    }).select("_id");

    if (!paymentTransaction?._id) {
        return null;
    }

    const withdrawalRequest = await withdrawalRequestModel.findOne({
        paymentTransactionId: paymentTransaction._id
    }).select("_id");

    return withdrawalRequest?._id ? String(withdrawalRequest._id) : null;
};

const resolvePartnerModeForDeposit = async ({
    parsedExternalRef,
    paymentTransactionId,
    paymentTransactionModel = PaymentTransaction,
    eventModel = Event,
    partnerModel = Partner
}) => {
    const paymentTransaction = await paymentTransactionModel.findById(paymentTransactionId)
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

        let matchedEvent = await eventModel.findOne(eventQuery)
            .sort({ createdAt: -1 })
            .select("partnerName operatingMode")
            .lean();

        if (!matchedEvent && paymentTransaction?.userId) {
            matchedEvent = await eventModel.findOne({ eventId: eventRef.eventId, userId: paymentTransaction.userId })
                .sort({ createdAt: -1 })
                .select("partnerName operatingMode")
                .lean();
        }

        if (!matchedEvent) {
            matchedEvent = await eventModel.findOne({ eventId: eventRef.eventId })
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
        const matchedEvent = await eventModel.findOne({ eventId: eventRef.eventId })
            .sort({ createdAt: -1 })
            .select("partnerName")
            .lean();
        partnerName = String(matchedEvent?.partnerName || "").trim();
    }

    if (!partnerName) {
        return "live";
    }

    const partner = await partnerModel.findOne({ name: partnerName })
        .select("operatingMode")
        .lean();
    return normalizeOperatingMode(partner?.operatingMode) || "demo";
};

const defaultPaymentCallbackHandlerDeps = {
    eventModel: Event,
    partnerModel: Partner,
    paymentTransactionModel: PaymentTransaction,
    withdrawalRequestModel: WithdrawalRequest,
    confirmDepositImpl: confirmDeposit,
    failDepositImpl: failDeposit,
    finalizeEventImpl: finalizeEvent,
    markWithdrawalDisbursedImpl: markWithdrawalDisbursed,
    markWithdrawalFailedImpl: markWithdrawalFailed,
    resolvePartnerModeForDepositImpl: resolvePartnerModeForDeposit
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
                transactionDesc: "Betsave deposit",
                callbackUrl: buildSignedCallbackUrl({
                    baseUrl: process.env.DARAJA_STK_CALLBACK_URL,
                    callbackType: "deposit",
                    resourceId: paymentTransaction._id
                })
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
                    occasion: `BETSAVE_WD_${withdrawalRequest._id}`,
                    timeoutUrl: buildSignedCallbackUrl({
                        baseUrl: process.env.DARAJA_B2C_TIMEOUT_URL,
                        callbackType: "withdrawal",
                        resourceId: withdrawalRequest._id
                    }),
                    resultUrl: buildSignedCallbackUrl({
                        baseUrl: process.env.DARAJA_B2C_RESULT_URL,
                        callbackType: "withdrawal",
                        resourceId: withdrawalRequest._id
                    })
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

export const createPaymentCallbackHandlers = (deps = {}) => {
    const {
        eventModel,
        partnerModel,
        paymentTransactionModel,
        withdrawalRequestModel,
        confirmDepositImpl,
        failDepositImpl,
        finalizeEventImpl,
        markWithdrawalDisbursedImpl,
        markWithdrawalFailedImpl,
        resolvePartnerModeForDepositImpl
    } = { ...defaultPaymentCallbackHandlerDeps, ...deps };

    const handleDepositCallback = async (req, res) => {
        try {
            const hintedPaymentTransactionId = getSignedCallbackResourceId({
                req,
                res,
                callbackType: "deposit",
                resourceParamName: "paymentTransactionId"
            });

            if (!hintedPaymentTransactionId) {
                return;
            }

            const parsed = parseDepositCallbackPayload(req.body || {});
            const resolvedPaymentTransactionId = await resolveDepositTransactionId({
                providerRequestId: parsed.providerRequestId,
                providerTransactionId: parsed.providerTransactionId,
                externalRef: parsed.externalRef,
                paymentTransactionModel
            });
            const canonicalPaymentTransactionId = ensureCallbackResourceBinding({
                callbackType: "deposit",
                hintedResourceId: hintedPaymentTransactionId,
                payloadResourceId: parsed.paymentTransactionId,
                resolvedResourceId: resolvedPaymentTransactionId
            });

            if (!mongoose.Types.ObjectId.isValid(canonicalPaymentTransactionId)) {
                return res.status(400).json({
                    status: "FAILED",
                    reason: "Invalid payment transaction id in callback"
                });
            }

            const callbackIsSuccess = isSuccessStatus(parsed.status);
            const paymentTransactionRecord = await paymentTransactionModel.findById(canonicalPaymentTransactionId)
                .select("_id amount phone externalRef channel providerRequestId userId")
                .lean();

            if (!paymentTransactionRecord) {
                return res.status(404).json({
                    status: "FAILED",
                    reason: "Payment transaction not found"
                });
            }

            validateDepositSettlement({
                paymentTransaction: paymentTransactionRecord,
                parsed,
                requireStructuredMetadata: callbackIsSuccess && Boolean(req.body?.Body?.stkCallback)
            });

            const partnerMode = await resolvePartnerModeForDepositImpl({
                parsedExternalRef: parsed.externalRef,
                paymentTransactionId: canonicalPaymentTransactionId,
                paymentTransactionModel,
                eventModel,
                partnerModel
            });

            const paymentTransaction = callbackIsSuccess
                ? await confirmDepositImpl({
                    paymentTransactionId: canonicalPaymentTransactionId,
                    providerRequestId: parsed.providerRequestId,
                    providerTransactionId: parsed.providerTransactionId,
                    externalRef: parsed.externalRef,
                    rawCallback: parsed.rawCallback,
                    applyWalletCredit: partnerMode === "live",
                    recordLiabilityLedger: true
                })
                : await failDepositImpl({
                    paymentTransactionId: canonicalPaymentTransactionId,
                    failureReason: parsed.failureReason,
                    rawCallback: parsed.rawCallback
                });

            if (String(paymentTransaction.channel || paymentTransactionRecord.channel || "").toUpperCase() === "STK") {
                await finalizeEventImpl({
                    paymentTransaction,
                    nextStatus: callbackIsSuccess ? "PROCESSED" : "FAILED",
                    failureReason: parsed.failureReason,
                    notifyPartner: true
                });
            }

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

    const handleWithdrawalCallback = async (req, res) => {
        try {
            const hintedWithdrawalRequestId = getSignedCallbackResourceId({
                req,
                res,
                callbackType: "withdrawal",
                resourceParamName: "withdrawalRequestId"
            });

            if (!hintedWithdrawalRequestId) {
                return;
            }

            const parsed = parseWithdrawalCallbackPayload(req.body || {});
            const resolvedWithdrawalRequestId = await resolveWithdrawalRequestId({
                providerRequestId: parsed.providerRequestId,
                providerTransactionId: parsed.providerTransactionId,
                paymentTransactionModel,
                withdrawalRequestModel
            });
            const canonicalWithdrawalRequestId = ensureCallbackResourceBinding({
                callbackType: "withdrawal",
                hintedResourceId: hintedWithdrawalRequestId,
                payloadResourceId: parsed.withdrawalRequestId,
                resolvedResourceId: resolvedWithdrawalRequestId
            });

            if (!mongoose.Types.ObjectId.isValid(canonicalWithdrawalRequestId)) {
                return res.status(400).json({
                    status: "FAILED",
                    reason: "Invalid withdrawal request id in callback"
                });
            }

            const withdrawalRequestRecord = await withdrawalRequestModel.findById(canonicalWithdrawalRequestId)
                .select("_id amount status paymentTransactionId")
                .lean();

            if (!withdrawalRequestRecord?.paymentTransactionId) {
                return res.status(404).json({
                    status: "FAILED",
                    reason: "Withdrawal request not found"
                });
            }

            const paymentTransactionRecord = await paymentTransactionModel.findById(withdrawalRequestRecord.paymentTransactionId)
                .select("_id amount phone externalRef providerRequestId status")
                .lean();

            if (!paymentTransactionRecord) {
                return res.status(404).json({
                    status: "FAILED",
                    reason: "Payment transaction not found"
                });
            }

            const callbackIsSuccess = isSuccessStatus(parsed.status);
            validateWithdrawalSettlement({
                paymentTransaction: paymentTransactionRecord,
                withdrawalRequest: withdrawalRequestRecord,
                parsed,
                requireStructuredMetadata: callbackIsSuccess && Boolean(req.body?.Result)
            });

            const { paymentTransaction, withdrawalRequest } = callbackIsSuccess
                ? await markWithdrawalDisbursedImpl({
                    withdrawalRequestId: canonicalWithdrawalRequestId,
                    providerRequestId: parsed.providerRequestId,
                    providerTransactionId: parsed.providerTransactionId,
                    externalRef: parsed.externalRef,
                    rawCallback: parsed.rawCallback
                })
                : await markWithdrawalFailedImpl({
                    withdrawalRequestId: canonicalWithdrawalRequestId,
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

    return {
        handleDepositCallback,
        handleWithdrawalCallback
    };
};

export const {
    handleDepositCallback,
    handleWithdrawalCallback
} = createPaymentCallbackHandlers();

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
