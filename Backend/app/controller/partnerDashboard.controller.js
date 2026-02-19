import Event from '../../database/models/event.model.js';
import Ledger from "../../database/models/ledger.model.js";
import PartnerNotification from "../../database/models/partnerNotification.model.js";
import PartnerUser from "../../database/models/partnerUser.model.js";
import Wallet from "../../database/models/wallet.model.js";

const clampNonNegative = (value) => Math.max(0, Number(value) || 0);

export const getPartnerEvents = async (req, res) => {
    try {
        const { name } = req.partner;
        const savingsPercentage = Number(process.env.SAVINGS_PERCENTAGE ?? 0.1);
        const safeSavingsPercentage =
            Number.isFinite(savingsPercentage) && savingsPercentage > 0 && savingsPercentage <= 1
                ? savingsPercentage
                : 0.1;

        const { status } = req.query;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

        const query = { partnerName: name };
        if (status) query.status = status;

        const events = await Event.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .lean();

        const eventIds = events.map((e) => e.eventId);
        const savingsByEvent = eventIds.length
            ? await Ledger.aggregate([
                { $match: { account: "USER_SAVINGS", eventId: { $in: eventIds } } },
                { $group: { _id: "$eventId", savingsAmount: { $sum: "$amount" } } }
            ])
            : [];

        const savingsMap = new Map(savingsByEvent.map((x) => [x._id, clampNonNegative(x.savingsAmount)]));
        const enrichedEvents = events.map((event) => ({
            ...event,
            savingsAmount:
                savingsMap.get(event.eventId) ??
                (event.status !== "FAILED" ? clampNonNegative(Math.round((event.amount || 0) * safeSavingsPercentage)) : 0)
        }));

        return res.json({
            status: 'SUCCESS',
            page,
            limit,
            count: enrichedEvents.length,
            events: enrichedEvents
        });
    } catch (error) {
        return res.status(500).json({
            status: 'FAILED',
            reason: error.message
        });
    }
};

export const getPartnerAnalytics = async (req, res) => {
    try {
        const { name } = req.partner;
        const savingsPercentage = Number(process.env.SAVINGS_PERCENTAGE ?? 0.1);
        const safeSavingsPercentage =
            Number.isFinite(savingsPercentage) && savingsPercentage > 0 && savingsPercentage <= 1
                ? savingsPercentage
                : 0.1;
    
        const [stat, processedAmountAgg, totalSavingsAgg, totalWalletAgg] = await Promise.all([
            Event.aggregate([
                { $match: { partnerName: name } },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalAmount: { $sum: "$amount" }
                    }
                }
            ]),
            Event.aggregate([
                { $match: { partnerName: name, status: "PROCESSED" } },
                { $group: { _id: null, totalProcessedAmount: { $sum: "$amount" } } }
            ]),
            Ledger.aggregate([
                { $match: { account: "USER_SAVINGS" } },
                {
                    $lookup: {
                        from: "events",
                        localField: "eventId",
                        foreignField: "eventId",
                        as: "event"
                    }
                },
                { $unwind: "$event" },
                { $match: { "event.partnerName": name, "event.status": "PROCESSED" } },
                { $group: { _id: null, totalSavings: { $sum: "$amount" } } }
            ]),
            Wallet.aggregate([
                { $match: { balance: { $gt: 0 } } },
                {
                    $lookup: {
                        from: "events",
                        let: { walletUserId: "$userId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$userId", "$$walletUserId"] },
                                            { $eq: ["$partnerName", name] },
                                            { $eq: ["$status", "PROCESSED"] }
                                        ]
                                    }
                                }
                            },
                            { $limit: 1 }
                        ],
                        as: "partnerEvent"
                    }
                },
                { $match: { partnerEvent: { $ne: [] } } },
                { $group: { _id: null, totalWalletBalance: { $sum: "$balance" } } }
            ])
        ]);
    
        const processedAmount = clampNonNegative(processedAmountAgg[0]?.totalProcessedAmount);
        const ledgerSavings = clampNonNegative(totalSavingsAgg[0]?.totalSavings);

        return res.json({
            status: 'SUCCESS',
            stat,
            totalProcessedAmount: processedAmount,
            totalSavings: ledgerSavings || clampNonNegative(Math.round(processedAmount * safeSavingsPercentage)),
            totalWalletBalance: clampNonNegative(totalWalletAgg[0]?.totalWalletBalance)
        });
    } catch (error) {
        return res.status(500).json({
            status: 'FAILED',
            reason: error.message
        });
    }
};

export const getPartnerSavingsBehavior = async (req, res) => {
    try {
        const { name } = req.partner;
        const savingsPercentage = Number(process.env.SAVINGS_PERCENTAGE ?? 0.1);
        const safeSavingsPercentage =
            Number.isFinite(savingsPercentage) && savingsPercentage > 0 && savingsPercentage <= 1
                ? savingsPercentage
                : 0.1;

        const [summaryAgg, behavior, processedEventsByUser] = await Promise.all([
            Ledger.aggregate([
                { $match: { account: "USER_SAVINGS" } },
                {
                    $lookup: {
                        from: "events",
                        localField: "eventId",
                        foreignField: "eventId",
                        as: "event"
                    }
                },
                { $unwind: "$event" },
                { $match: { "event.partnerName": name, "event.status": "PROCESSED" } },
                {
                    $group: {
                        _id: null,
                        totalSavings: { $sum: "$amount" },
                        savingsEntries: { $sum: 1 },
                        uniqueUsers: { $addToSet: "$userId" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalSavings: 1,
                        savingsEntries: 1,
                        uniqueUsers: { $size: "$uniqueUsers" }
                    }
                }
            ]),
            Ledger.aggregate([
                { $match: { account: "USER_SAVINGS", userId: { $type: "objectId" } } },
                {
                    $lookup: {
                        from: "events",
                        localField: "eventId",
                        foreignField: "eventId",
                        as: "event"
                    }
                },
                { $unwind: "$event" },
                { $match: { "event.partnerName": name, "event.status": "PROCESSED" } },
                {
                    $group: {
                        _id: "$userId",
                        totalSaved: { $sum: "$amount" },
                        savingsEvents: { $sum: 1 },
                        lastSavedAt: { $max: "$createdAt" }
                    }
                },
                { $sort: { totalSaved: -1 } },
                { $limit: 50 },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        userId: "$_id",
                        phoneNumber: "$user.phoneNumber",
                        totalSaved: 1,
                        savingsEvents: 1,
                        lastSavedAt: 1
                    }
                }
            ]),
            Event.aggregate([
                { $match: { partnerName: name, status: "PROCESSED", userId: { $type: "objectId" } } },
                {
                    $group: {
                        _id: "$userId",
                        totalAmount: { $sum: "$amount" },
                        processedEvents: { $sum: 1 },
                        lastSavedAt: { $max: "$createdAt" }
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 0,
                        userId: "$_id",
                        phoneNumber: "$user.phoneNumber",
                        totalSaved: { $round: [{ $multiply: ["$totalAmount", safeSavingsPercentage] }, 0] },
                        savingsEvents: "$processedEvents",
                        lastSavedAt: 1
                    }
                },
                { $sort: { totalSaved: -1 } },
                { $limit: 50 }
            ])
        ]);

        const summary = summaryAgg[0] || { totalSavings: 0, savingsEntries: 0, uniqueUsers: 0 };
        const effectiveUsers = behavior.length ? behavior : processedEventsByUser;
        const totalFromUsers = effectiveUsers.reduce((sum, user) => sum + clampNonNegative(user.totalSaved), 0);
        const entriesFromUsers = effectiveUsers.reduce((sum, user) => sum + (Number(user.savingsEvents) || 0), 0);

        return res.json({
            status: "SUCCESS",
            summary: {
                totalSavings: clampNonNegative(summary.totalSavings) || clampNonNegative(totalFromUsers),
                savingsEntries: summary.savingsEntries || entriesFromUsers,
                uniqueUsers: summary.uniqueUsers || effectiveUsers.length
            },
            users: effectiveUsers.map((user) => ({
                ...user,
                totalSaved: clampNonNegative(user.totalSaved)
            }))
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getPartnerUsers = async (req, res) => {
    try {
        const partnerId = req.partner.id;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [partnerUsers, total] = await Promise.all([
            PartnerUser.find({ partnerId, status: "ACTIVE" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PartnerUser.countDocuments({ partnerId, status: "ACTIVE" })
        ]);

        return res.json({
            status: "SUCCESS",
            page,
            limit,
            total,
            users: partnerUsers
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getPartnerNotifications = async (req, res) => {
    try {
        const partnerId = req.partner.id;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            PartnerNotification.find({ partnerId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PartnerNotification.countDocuments({ partnerId })
        ]);

        return res.json({
            status: "SUCCESS",
            page,
            limit,
            total,
            notifications
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};
