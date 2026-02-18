import mongoose from "mongoose"
import Ledger from "../database/models/ledger.model.js";
import Wallet from "../database/models/wallet.model.js";

export const creditWallet = async ({ userId, eventId, amount, reference }) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    const creditAmount = Number(amount);
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
        throw new Error('Invalid credit amount');
    }

    try {
        // Idempotency guard: if savings ledger already exists for this event/user,
        // return current wallet state and avoid double-crediting.
        const existingSavingsEntry = await Ledger.findOne({
            eventId,
            userId,
            account: "USER_SAVINGS"
        })
            .session(session)
            .select("_id");

        if (existingSavingsEntry) {
            const existingWallet = await Wallet.findOne({ userId }).session(session);
            await session.commitTransaction();
            return existingWallet;
        }

        const entries = [
            {
                eventId,
                userId,
                account: 'OPERATOR_CLEARING',
                amount: -creditAmount,
                reference,
            },
            {
                eventId,
                userId,
                account: 'USER_SAVINGS',
                amount: +creditAmount,
                reference,
            }
        ]

        // Validate ledger entries
        const total = entries.reduce((sum, e) => sum + e.amount, 0);
        if(total !== 0){
            throw new Error('Ledger imbalance detected!');
        }

        const ledgerDocs = await Ledger.insertMany(entries, { session });
        const savingsEntry = ledgerDocs.find(e => e.account === 'USER_SAVINGS');

        // Update wallet
        const wallet = await Wallet.findOneAndUpdate(
            { userId },
            {
                $inc: { balance: creditAmount },
                $set: { lastProcessedLedgerId: savingsEntry._id },
            },
            {
                session,
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        await session.commitTransaction();
        return wallet;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}
