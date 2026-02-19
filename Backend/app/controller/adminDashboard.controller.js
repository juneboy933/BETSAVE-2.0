import Event from "../../database/models/event.model.js";
import Ledger from "../../database/models/ledger.model.js";
import Partner from "../../database/models/partner.model.js";
import PartnerUser from "../../database/models/partnerUser.model.js";
import User from "../../database/models/user.model.js";
import Wallet from "../../database/models/wallet.model.js";
import mongoose from "mongoose";
import { sendpartnerWebhook } from "../../service/notifyPartner.service.js";

const parsePagination = (query) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { page, limit };
};

const clampNonNegative = (value) => Math.max(0, Number(value) || 0);

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

        return res.json({
            status: "SUCCESS",
            page,
            limit,
            total,
            users
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

        const uniquePartnerNames = [...new Set(partnerLinks.map((link) => link.partnerName).filter(Boolean))];

        await PartnerUser.updateMany(
            { userId: user._id },
            { $set: { status: "SUSPENDED" } }
        );

        let notifiedPartners = 0;
        if (shouldNotifyPartners && uniquePartnerNames.length) {
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

export const getAdminEvents = async (req, res) => {
    try {
        const { page, limit } = parsePagination(req.query);
        const skip = (page - 1) * limit;

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
