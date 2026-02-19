import Event from "../../database/models/event.model.js";
import Ledger from "../../database/models/ledger.model.js";
import Partner from "../../database/models/partner.model.js";
import PartnerUser from "../../database/models/partnerUser.model.js";
import User from "../../database/models/user.model.js";
import Wallet from "../../database/models/wallet.model.js";
import mongoose from "mongoose";
import { sendpartnerWebhook } from "../../service/notifyPartner.service.js";
import PartnerNotification from "../../database/models/partnerNotification.model.js";
import AdminNotification from "../../database/models/adminNotification.model.js";

const parsePagination = (query) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { page, limit };
};

const clampNonNegative = (value) => Math.max(0, Number(value) || 0);

const logAdminDecision = async (req, payload) => {
    try {
        await AdminNotification.create({
            ...payload,
            actorName: req.admin?.name || "Admin",
            actorEmail: req.admin?.email || null
        });
    } catch (error) {
        console.error("Failed to log admin decision:", error.message);
    }
};

export const getAdminOverview = async (_req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            totalPartners,
            activePartners,
            totalEvents,
            totalWalletBalance,
            totalSavingsLedger,
            eventByStatus
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ status: "ACTIVE" }),
            Partner.countDocuments(),
            Partner.countDocuments({ status: "ACTIVE" }),
            Event.countDocuments(),
            Wallet.aggregate([
                { $group: { _id: null, balance: { $sum: "$balance" } } }
            ]),
            Ledger.aggregate([
                { $match: { account: "USER_SAVINGS" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),
            Event.aggregate([
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        return res.json({
            status: "SUCCESS",
            metrics: {
                totalUsers,
                activeUsers,
                totalPartners,
                activePartners,
                totalEvents,
                totalWalletBalance: clampNonNegative(totalWalletBalance[0]?.balance),
                totalSavingsLedger: clampNonNegative(totalSavingsLedger[0]?.total)
            },
            eventByStatus
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getAdminPartners = async (req, res) => {
    try {
        const { page, limit } = parsePagination(req.query);
        const skip = (page - 1) * limit;

        const [partners, eventStats, total] = await Promise.all([
            Partner.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("name status webhookUrl createdAt")
                .lean(),
            Event.aggregate([
                {
                    $group: {
                        _id: "$partnerName",
                        totalEvents: { $sum: 1 },
                        processedEvents: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "PROCESSED"] }, 1, 0]
                            }
                        },
                        failedEvents: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0]
                            }
                        },
                        totalAmount: { $sum: "$amount" }
                    }
                }
            ]),
            Partner.countDocuments()
        ]);

        const statsByName = new Map(eventStats.map((stat) => [stat._id, stat]));
        const data = partners.map((partner) => {
            const stat = statsByName.get(partner.name);
            return {
                ...partner,
                stats: {
                    totalEvents: stat?.totalEvents || 0,
                    processedEvents: stat?.processedEvents || 0,
                    failedEvents: stat?.failedEvents || 0,
                    totalAmount: stat?.totalAmount || 0
                }
            };
        });

        return res.json({
            status: "SUCCESS",
            page,
            limit,
            total,
            partners: data
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getAdminUsers = async (req, res) => {
    try {
        const { page, limit } = parsePagination(req.query);
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("phoneNumber verified status createdAt")
                .lean(),
            User.countDocuments()
        ]);

        const userIds = users.map((user) => user._id);
        const partnerLinks = userIds.length
            ? await PartnerUser.find({ userId: { $in: userIds } })
                .select("userId partnerName")
                .lean()
            : [];

        const partnersByUserId = new Map();
        partnerLinks.forEach((link) => {
            const key = String(link.userId);
            const current = partnersByUserId.get(key) || new Set();
            if (link.partnerName) current.add(link.partnerName);
            partnersByUserId.set(key, current);
        });

        const enrichedUsers = users.map((user) => {
            const partners = [...(partnersByUserId.get(String(user._id)) || new Set())];
            return {
                ...user,
                partners,
                partnerCount: partners.length
            };
        });

        return res.json({
            status: "SUCCESS",
            page,
            limit,
            total,
            users: enrichedUsers
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getAdminUserSavingsBreakdown = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const objectUserId = new mongoose.Types.ObjectId(userId);

        const [user, wallet, totals, byPartner] = await Promise.all([
            User.findById(objectUserId).select("_id phoneNumber status").lean(),
            Wallet.findOne({ userId: objectUserId }).select("balance").lean(),
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
            Ledger.aggregate([
                { $match: { userId: objectUserId, account: "USER_SAVINGS" } },
                {
                    $lookup: {
                        from: "events",
                        localField: "eventId",
                        foreignField: "eventId",
                        as: "event"
                    }
                },
                { $unwind: "$event" },
                {
                    $group: {
                        _id: "$event.partnerName",
                        totalSaved: { $sum: "$amount" },
                        entries: { $sum: 1 }
                    }
                },
                { $sort: { totalSaved: -1 } }
            ])
        ]);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                reason: "User not found"
            });
        }

        const summary = totals[0] || { totalSaved: 0, entries: 0 };
        const safeByPartner = byPartner.map((item) => ({
            partnerName: item._id || "UNKNOWN",
            totalSaved: clampNonNegative(item.totalSaved),
            entries: item.entries || 0
        }));

        return res.json({
            status: "SUCCESS",
            user,
            walletBalance: clampNonNegative(wallet?.balance),
            totalSaved: clampNonNegative(summary.totalSaved),
            totalEntries: summary.entries || 0,
            byPartner: safeByPartner
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const updatePartnerStatus = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(partnerId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid partner id"
            });
        }

        if (!["ACTIVE", "SUSPENDED"].includes(status)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Status must be ACTIVE or SUSPENDED"
            });
        }

        const partner = await Partner.findByIdAndUpdate(
            partnerId,
            { $set: { status } },
            { new: true }
        ).select("name status webhookUrl updatedAt");

        if (!partner) {
            return res.status(404).json({
                status: "FAILED",
                reason: "Partner not found"
            });
        }

        await logAdminDecision(req, {
            action: "PARTNER_STATUS_UPDATED",
            title: "Partner Status Updated",
            message: `Partner ${partner.name} status changed to ${partner.status}.`,
            targetType: "PARTNER",
            targetId: String(partnerId),
            metadata: {
                status: partner.status,
                webhookUrl: partner.webhookUrl
            }
        });

        return res.json({
            status: "SUCCESS",
            partner
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const suspendUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason, photoUrl, notifyPartners } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const normalizedReason = String(reason || "").trim();
        if (!normalizedReason) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Suspension reason is required"
            });
        }

        const normalizedPhotoUrl = String(photoUrl || "").trim();
        const shouldNotifyPartners = Boolean(notifyPartners);

        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    status: "SUSPENDED",
                    suspension: {
                        reason: normalizedReason,
                        photoUrl: normalizedPhotoUrl || null,
                        notifyPartners: shouldNotifyPartners,
                        suspendedAt: new Date()
                    }
                }
            },
            { new: true }
        ).select("_id phoneNumber status suspension");

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                reason: "User not found"
            });
        }

        const partnerLinks = await PartnerUser.find({ userId: user._id })
            .select("partnerId partnerName")
            .lean();

        const uniquePartners = [
            ...new Map(
                partnerLinks
                    .filter((link) => link.partnerId && link.partnerName)
                    .map((link) => [String(link.partnerId), link])
            ).values()
        ];
        const uniquePartnerNames = uniquePartners.map((partner) => partner.partnerName);

        await PartnerUser.updateMany(
            { userId: user._id },
            { $set: { status: "SUSPENDED" } }
        );

        let notifiedPartners = 0;
        if (shouldNotifyPartners && uniquePartnerNames.length) {
            await PartnerNotification.insertMany(
                uniquePartners.map((partner) => ({
                    partnerId: partner.partnerId,
                    partnerName: partner.partnerName,
                    type: "USER_SUSPENDED",
                    title: "User Suspended By Admin",
                    message: `User ${user.phoneNumber} was suspended by admin. Reason: ${normalizedReason}`,
                    payload: {
                        userId: String(user._id),
                        phoneNumber: user.phoneNumber,
                        reason: normalizedReason,
                        photoUrl: normalizedPhotoUrl || null,
                        suspendedAt: user.suspension?.suspendedAt || new Date().toISOString()
                    },
                    source: "ADMIN"
                }))
            );

            await Promise.all(
                uniquePartnerNames.map(async (partnerName) => {
                    await sendpartnerWebhook({
                        partnerName,
                        payload: {
                            eventType: "USER_SUSPENDED",
                            occurredAt: new Date().toISOString(),
                            user: {
                                id: String(user._id),
                                phoneNumber: user.phoneNumber,
                                status: user.status,
                                photoUrl: user.suspension?.photoUrl || null
                            },
                            reason: user.suspension?.reason || normalizedReason
                        }
                    });
                })
            );
            notifiedPartners = uniquePartnerNames.length;
        }

        await logAdminDecision(req, {
            action: "USER_SUSPENDED",
            title: "User Suspended",
            message: `User ${user.phoneNumber} was suspended.`,
            targetType: "USER",
            targetId: String(user._id),
            metadata: {
                reason: normalizedReason,
                notifyPartners: shouldNotifyPartners,
                partnerCount: uniquePartnerNames.length,
                notifiedPartners
            }
        });

        return res.json({
            status: "SUCCESS",
            user,
            partnerCount: uniquePartnerNames.length,
            notifiedPartners
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const activateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { notifyPartners } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        const shouldNotifyPartners = Boolean(notifyPartners);
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    status: "ACTIVE",
                    "suspension.notifyPartners": shouldNotifyPartners
                },
                $unset: {
                    "suspension.reason": 1,
                    "suspension.photoUrl": 1,
                    "suspension.suspendedAt": 1
                }
            },
            { new: true }
        ).select("_id phoneNumber status");

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                reason: "User not found"
            });
        }

        const partnerLinks = await PartnerUser.find({ userId: user._id })
            .select("partnerId partnerName")
            .lean();

        const uniquePartners = [
            ...new Map(
                partnerLinks
                    .filter((link) => link.partnerId && link.partnerName)
                    .map((link) => [String(link.partnerId), link])
            ).values()
        ];
        const uniquePartnerNames = uniquePartners.map((partner) => partner.partnerName);

        await PartnerUser.updateMany(
            { userId: user._id },
            { $set: { status: "ACTIVE" } }
        );

        let notifiedPartners = 0;
        if (shouldNotifyPartners && uniquePartnerNames.length) {
            await PartnerNotification.insertMany(
                uniquePartners.map((partner) => ({
                    partnerId: partner.partnerId,
                    partnerName: partner.partnerName,
                    type: "USER_ACTIVATED",
                    title: "User Reactivated By Admin",
                    message: `User ${user.phoneNumber} was reactivated by admin.`,
                    payload: {
                        userId: String(user._id),
                        phoneNumber: user.phoneNumber,
                        activatedAt: new Date().toISOString()
                    },
                    source: "ADMIN"
                }))
            );

            await Promise.all(
                uniquePartnerNames.map(async (partnerName) => {
                    await sendpartnerWebhook({
                        partnerName,
                        payload: {
                            eventType: "USER_ACTIVATED",
                            occurredAt: new Date().toISOString(),
                            user: {
                                id: String(user._id),
                                phoneNumber: user.phoneNumber,
                                status: user.status
                            }
                        }
                    });
                })
            );
            notifiedPartners = uniquePartnerNames.length;
        }

        await logAdminDecision(req, {
            action: "USER_ACTIVATED",
            title: "User Activated",
            message: `User ${user.phoneNumber} was activated.`,
            targetType: "USER",
            targetId: String(user._id),
            metadata: {
                notifyPartners: shouldNotifyPartners,
                partnerCount: uniquePartnerNames.length,
                notifiedPartners
            }
        });

        return res.json({
            status: "SUCCESS",
            user,
            partnerCount: uniquePartnerNames.length,
            notifiedPartners
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getAdminNotifications = async (req, res) => {
    try {
        const { page, limit } = parsePagination(req.query);
        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            AdminNotification.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AdminNotification.countDocuments()
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

export const getAdminEvents = async (req, res) => {
    try {
        const { page, limit } = parsePagination(req.query);
        const skip = (page - 1) * limit;
        const savingsPercentage = Number(process.env.SAVINGS_PERCENTAGE ?? 0.1);
        const safeSavingsPercentage =
            Number.isFinite(savingsPercentage) && savingsPercentage > 0 && savingsPercentage <= 1
                ? savingsPercentage
                : 0.1;

        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.partnerName) query.partnerName = req.query.partnerName;
        if (req.query.phone) query.phone = req.query.phone;

        const [events, total] = await Promise.all([
            Event.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Event.countDocuments(query)
        ]);

        const eventIds = events.map((event) => event.eventId);
        const savingsByEvent = eventIds.length
            ? await Ledger.aggregate([
                { $match: { account: "USER_SAVINGS", eventId: { $in: eventIds } } },
                { $group: { _id: "$eventId", savingsAmount: { $sum: "$amount" } } }
            ])
            : [];

        const savingsMap = new Map(
            savingsByEvent.map((item) => [item._id, clampNonNegative(item.savingsAmount)])
        );
        const enrichedEvents = events.map((event) => ({
            ...event,
            savingsAmount:
                savingsMap.get(event.eventId) ??
                (event.status !== "FAILED"
                    ? clampNonNegative(Math.round((event.amount || 0) * safeSavingsPercentage))
                    : 0)
        }));

        return res.json({
            status: "SUCCESS",
            page,
            limit,
            total,
            events: enrichedEvents
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getAdminSavings = async (_req, res) => {
    try {
        const [summary, byPartner, latestLedger] = await Promise.all([
            Ledger.aggregate([
                { $match: { account: "USER_SAVINGS" } },
                {
                    $group: {
                        _id: null,
                        totalSavings: { $sum: "$amount" },
                        totalEntries: { $sum: 1 }
                    }
                }
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
                {
                    $group: {
                        _id: "$event.partnerName",
                        totalSavings: { $sum: "$amount" },
                        entries: { $sum: 1 }
                    }
                },
                { $sort: { totalSavings: -1 } }
            ]),
            Ledger.find({ account: "USER_SAVINGS" })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean()
        ]);

        const safeSummary = summary[0] || { totalSavings: 0, totalEntries: 0 };
        const safeByPartner = byPartner.map((partner) => ({
            ...partner,
            totalSavings: clampNonNegative(partner.totalSavings)
        }));

        return res.json({
            status: "SUCCESS",
            summary: {
                ...safeSummary,
                totalSavings: clampNonNegative(safeSummary.totalSavings)
            },
            byPartner: safeByPartner,
            recentSavingsEntries: latestLedger
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

export const getAdminOperations = async (_req, res) => {
    try {
        const [failedEvents, suspendedPartners, totalPartnerUsers] = await Promise.all([
            Event.countDocuments({ status: "FAILED" }),
            Partner.countDocuments({ status: "SUSPENDED" }),
            PartnerUser.countDocuments()
        ]);

        const integrationReadiness = {
            bankApiUrlConfigured: Boolean(process.env.BANK_API_URL),
            bankApiKeyConfigured: Boolean(process.env.BANK_API_KEY),
            settlementAccountConfigured: Boolean(process.env.BANK_SETTLEMENT_ACCOUNT)
        };

        return res.json({
            status: "SUCCESS",
            operations: {
                failedEvents,
                suspendedPartners,
                totalPartnerUsers
            },
            integrationReadiness,
            roadmap: {
                nextMilestones: [
                    "Implement settlement deposits to external financial institutions",
                    "Implement user withdrawal request + approval + disbursement flow",
                    "Add reconciliation jobs for internal ledger vs bank settlements"
                ]
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};
