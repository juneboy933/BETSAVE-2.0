import mongoose from "mongoose";
import Event from "../../database/models/event.model.js";
import Ledger from "../../database/models/ledger.model.js";
import User from "../../database/models/user.model.js";
import Wallet from "../../database/models/wallet.model.js";

const parsePagination = (query) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { page, limit };
};

export const getUserDashboardSummary = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const objectUserId = new mongoose.Types.ObjectId(userId);

        const [user, wallet, eventStats, savingsStats, recentEvents, recentTransactions] = await Promise.all([
            User.findById(objectUserId).select("phoneNumber status verified createdAt").lean(),
            Wallet.findOne({ userId: objectUserId }).select("balance updatedAt").lean(),
            Event.aggregate([
                { $match: { userId: objectUserId } },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalAmount: { $sum: "$amount" }
                    }
                }
            ]),
            Ledger.aggregate([
                { $match: { userId: objectUserId, account: "USER_SAVINGS" } },
                {
                    $group: {
                        _id: null,
                        totalSaved: { $sum: "$amount" },
                        entries: { $sum: 1 }
                    }
                }
            ]),
            Event.find({ userId: objectUserId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            Ledger.find({ userId: objectUserId, account: "USER_SAVINGS" })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean()
        ]);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                reason: "User not found"
            });
        }

        return res.json({
            status: "SUCCESS",
            user,
            wallet: wallet || { balance: 0 },
            eventStats,
            savings: savingsStats[0] || { totalSaved: 0, entries: 0 },
            recentEvents,
            recentTransactions
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getUserEvents = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const { page, limit } = parsePagination(req.query);
        const query = { userId: new mongoose.Types.ObjectId(userId) };
        if (req.query.status) query.status = req.query.status;

        const [events, total] = await Promise.all([
            Event.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Event.countDocuments(query)
        ]);

        return res.json({
            status: "SUCCESS",
            page,
            limit,
            total,
            events
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getUserTransactions = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const { page, limit } = parsePagination(req.query);
        const query = {
            userId: new mongoose.Types.ObjectId(userId),
            account: "USER_SAVINGS"
        };

        const [transactions, total] = await Promise.all([
            Ledger.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Ledger.countDocuments(query)
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
