import mongoose from "mongoose";
import Ledger from "../database/models/ledger.model.js";
import Wallet from "../database/models/wallet.model.js";

const EPSILON = 0.000001;

const sumAmounts = (entries) => entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

export const postLedger = async ({
    userId,
    eventId,
    reference,
    entries,
    walletDelta = 0,
    idempotencyQuery = null,
    checkpointAccount = null,
    enforceNonNegativeBalance = false
}) => {
    if (!userId) {
        throw new Error("userId is required");
    }

    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error("entries must be a non-empty array");
    }

    const normalizedWalletDelta = Number(walletDelta);
    if (!Number.isFinite(normalizedWalletDelta)) {
        throw new Error("Invalid walletDelta");
    }

    const total = sumAmounts(entries);
    if (!Number.isFinite(total) || Math.abs(total) > EPSILON) {
        throw new Error("Ledger imbalance detected");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (idempotencyQuery && typeof idempotencyQuery === "object") {
            const existingEntry = await Ledger.findOne(idempotencyQuery)
                .session(session)
                .select("_id");

            if (existingEntry) {
                const existingWallet = await Wallet.findOne({ userId }).session(session);
                await session.commitTransaction();
                return {
                    wallet: existingWallet,
                    ledgerDocs: [],
                    wasDuplicate: true
                };
            }
        }

        const currentWallet = await Wallet.findOne({ userId }).session(session).select("balance");
        const currentBalance = Number(currentWallet?.balance || 0);
        if (enforceNonNegativeBalance && currentBalance + normalizedWalletDelta < -EPSILON) {
            throw new Error("Insufficient wallet balance");
        }

        const docsToInsert = entries.map((entry) => ({
            eventId: entry.eventId || eventId,
            userId,
            account: entry.account,
            amount: Number(entry.amount),
            currency: entry.currency || "KES",
            reference: entry.reference || reference
        }));

        const ledgerDocs = await Ledger.insertMany(docsToInsert, { session });

        const checkpointEntry = checkpointAccount
            ? ledgerDocs.find((entry) => entry.account === checkpointAccount)
            : ledgerDocs[ledgerDocs.length - 1];

        const walletUpdate = {
            $set: {
                ...(checkpointEntry ? { lastProcessedLedgerId: checkpointEntry._id } : {})
            }
        };

        if (Math.abs(normalizedWalletDelta) > EPSILON) {
            walletUpdate.$inc = { balance: normalizedWalletDelta };
        }

        const wallet = await Wallet.findOneAndUpdate(
            { userId },
            walletUpdate,
            {
                session,
                upsert: true,
                returnDocument: "after",
                setDefaultsOnInsert: true
            }
        );

        await session.commitTransaction();

        return {
            wallet,
            ledgerDocs,
            wasDuplicate: false
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};
