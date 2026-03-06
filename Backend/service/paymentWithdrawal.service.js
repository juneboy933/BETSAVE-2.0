import PaymentTransaction from "../database/models/paymentTransaction.model.js";
import Wallet from "../database/models/wallet.model.js";
import WithdrawalRequest from "../database/models/withdrawalRequest.model.js";
import { postLedger } from "./postLedger.service.js";

const KENYA_PHONE_REGEX = /^\+254\d{9}$/;

const normalizePhone = (phone) => String(phone || "").trim();
const parsePositiveNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};
const MIN_WITHDRAWAL_KES = parsePositiveNumber(process.env.WITHDRAWAL_MIN_KES, 100);

const validateAmount = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Invalid amount");
    }
    return value;
};

const buildReserveEventId = (withdrawalRequestId) => `WITHDRAWAL_${withdrawalRequestId}_RESERVE`;
const buildDisburseEventId = (withdrawalRequestId) => `WITHDRAWAL_${withdrawalRequestId}_DISBURSE`;
const buildReverseEventId = (withdrawalRequestId) => `WITHDRAWAL_${withdrawalRequestId}_REVERSE`;

export const createWithdrawalRequest = async ({ userId, phone, amount, idempotencyKey, notes = null }) => {
    if (!idempotencyKey) {
        throw new Error("idempotencyKey is required");
    }

    const normalizedPhone = normalizePhone(phone);
    if (!KENYA_PHONE_REGEX.test(normalizedPhone)) {
        throw new Error("Invalid phone number format. Use +254XXXXXXXXX");
    }

    const withdrawalAmount = validateAmount(amount);
    if (withdrawalAmount < MIN_WITHDRAWAL_KES) {
        throw new Error(`Minimum withdrawal amount is KES ${MIN_WITHDRAWAL_KES}`);
    }

    const existingPaymentTx = await PaymentTransaction.findOne({ idempotencyKey });
    if (existingPaymentTx) {
        const linkedWithdrawal = await WithdrawalRequest.findOne({ paymentTransactionId: existingPaymentTx._id });
        return { paymentTransaction: existingPaymentTx, withdrawalRequest: linkedWithdrawal };
    }

    const wallet = await Wallet.findOne({ userId }).lean();
    const currentBalance = Number(wallet?.balance || 0);
    if (currentBalance < MIN_WITHDRAWAL_KES) {
        throw new Error(`Minimum wallet balance to withdraw is KES ${MIN_WITHDRAWAL_KES}`);
    }
    if (currentBalance < withdrawalAmount) {
        throw new Error("Insufficient wallet balance");
    }

    let paymentTransaction = null;
    let withdrawalRequest = null;

    try {
        paymentTransaction = await PaymentTransaction.create({
            type: "WITHDRAWAL",
            channel: "B2C",
            status: "INITIATED",
            userId,
            phone: normalizedPhone,
            amount: withdrawalAmount,
            currency: "KES",
            externalRef: null,
            idempotencyKey
        });

        withdrawalRequest = await WithdrawalRequest.create({
            userId,
            amount: withdrawalAmount,
            status: "REQUESTED",
            paymentTransactionId: paymentTransaction._id,
            notes
        });

        const reserveEventId = buildReserveEventId(withdrawalRequest._id);
        await postLedger({
            userId,
            eventId: reserveEventId,
            reference: `withdrawal_reserve_${withdrawalRequest._id}`,
            entries: [
                {
                    eventId: reserveEventId,
                    account: "USER_WALLET_LIABILITY",
                    amount: -withdrawalAmount
                },
                {
                    eventId: reserveEventId,
                    account: "WITHDRAWAL_PENDING",
                    amount: withdrawalAmount
                }
            ],
            walletDelta: -withdrawalAmount,
            idempotencyQuery: {
                eventId: reserveEventId,
                userId,
                account: "WITHDRAWAL_PENDING"
            },
            checkpointAccount: "WITHDRAWAL_PENDING",
            enforceNonNegativeBalance: true
        });

        withdrawalRequest.status = "RESERVED";
        paymentTransaction.status = "PENDING";

        await Promise.all([withdrawalRequest.save(), paymentTransaction.save()]);

        return { paymentTransaction, withdrawalRequest };
    } catch (error) {
        if (paymentTransaction?._id) {
            await PaymentTransaction.findByIdAndUpdate(paymentTransaction._id, {
                $set: {
                    status: "FAILED",
                    failureReason: String(error.message || "Withdrawal reservation failed")
                }
            });
        }
        if (withdrawalRequest?._id) {
            await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
                $set: {
                    status: "FAILED",
                    notes: notes || "Withdrawal reservation failed"
                }
            });
        }
        throw error;
    }
};

export const markWithdrawalDisbursed = async ({ withdrawalRequestId, providerRequestId = null, providerTransactionId = null, externalRef = null, rawCallback = null }) => {
    const withdrawalRequest = await WithdrawalRequest.findById(withdrawalRequestId);
    if (!withdrawalRequest) {
        throw new Error("Withdrawal request not found");
    }

    const paymentTransaction = await PaymentTransaction.findById(withdrawalRequest.paymentTransactionId);
    if (!paymentTransaction) {
        throw new Error("Payment transaction not found");
    }

    if (withdrawalRequest.status === "DISBURSED") {
        return { paymentTransaction, withdrawalRequest };
    }

    const disburseEventId = buildDisburseEventId(withdrawalRequest._id);
    await postLedger({
        userId: withdrawalRequest.userId,
        eventId: disburseEventId,
        reference: externalRef || `withdrawal_disburse_${withdrawalRequest._id}`,
        entries: [
            {
                eventId: disburseEventId,
                account: "WITHDRAWAL_PENDING",
                amount: -withdrawalRequest.amount
            },
            {
                eventId: disburseEventId,
                account: "MPESA_DISBURSEMENT",
                amount: withdrawalRequest.amount
            }
        ],
        walletDelta: 0,
        idempotencyQuery: {
            eventId: disburseEventId,
            userId: withdrawalRequest.userId,
            account: "MPESA_DISBURSEMENT"
        },
        checkpointAccount: "MPESA_DISBURSEMENT"
    });

    withdrawalRequest.status = "DISBURSED";
    paymentTransaction.status = "SUCCESS";
    paymentTransaction.providerRequestId = providerRequestId || paymentTransaction.providerRequestId;
    paymentTransaction.providerTransactionId = providerTransactionId || paymentTransaction.providerTransactionId;
    paymentTransaction.externalRef = externalRef || paymentTransaction.externalRef;
    paymentTransaction.rawCallback = rawCallback || paymentTransaction.rawCallback;

    await Promise.all([withdrawalRequest.save(), paymentTransaction.save()]);

    return { paymentTransaction, withdrawalRequest };
};

export const markWithdrawalFailed = async ({ withdrawalRequestId, failureReason, rawCallback = null }) => {
    const withdrawalRequest = await WithdrawalRequest.findById(withdrawalRequestId);
    if (!withdrawalRequest) {
        throw new Error("Withdrawal request not found");
    }

    const paymentTransaction = await PaymentTransaction.findById(withdrawalRequest.paymentTransactionId);
    if (!paymentTransaction) {
        throw new Error("Payment transaction not found");
    }

    const isReserved = withdrawalRequest.status === "RESERVED";
    if (isReserved) {
        const reverseEventId = buildReverseEventId(withdrawalRequest._id);
        await postLedger({
            userId: withdrawalRequest.userId,
            eventId: reverseEventId,
            reference: `withdrawal_reverse_${withdrawalRequest._id}`,
            entries: [
                {
                    eventId: reverseEventId,
                    account: "WITHDRAWAL_PENDING",
                    amount: -withdrawalRequest.amount
                },
                {
                    eventId: reverseEventId,
                    account: "USER_WALLET_LIABILITY",
                    amount: withdrawalRequest.amount
                }
            ],
            walletDelta: withdrawalRequest.amount,
            idempotencyQuery: {
                eventId: reverseEventId,
                userId: withdrawalRequest.userId,
                account: "USER_WALLET_LIABILITY"
            },
            checkpointAccount: "USER_WALLET_LIABILITY"
        });
    }

    withdrawalRequest.status = isReserved ? "REVERSED" : "FAILED";
    paymentTransaction.status = "FAILED";
    paymentTransaction.failureReason = String(failureReason || "Withdrawal failed");
    paymentTransaction.rawCallback = rawCallback || paymentTransaction.rawCallback;

    await Promise.all([withdrawalRequest.save(), paymentTransaction.save()]);

    return { paymentTransaction, withdrawalRequest };
};
