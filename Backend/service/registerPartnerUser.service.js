import mongoose from "mongoose";
import PartnerUser from "../database/models/partnerUser.model.js";
import User from "../database/models/user.model.js";
import Wallet from "../database/models/wallet.model.js";

const KENYA_PHONE_REGEX = /^\+254\d{9}$/;

export const registerPartnerUser = async ({ partner, phone }) => {
    const normalizedPhone = phone?.trim();
    if (!normalizedPhone || !KENYA_PHONE_REGEX.test(normalizedPhone)) {
        throw new Error("Invalid phone number");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let user = await User.findOne({ phoneNumber: normalizedPhone }).session(session);

        if (!user) {
            const createdUsers = await User.create([{ phoneNumber: normalizedPhone }], { session });
            user = createdUsers[0];

            await Wallet.create(
                [{
                    userId: user._id,
                    balance: 0,
                    lastProcessedLedgerId: null
                }],
                { session }
            );
        }

        const partnerUser = await PartnerUser.findOneAndUpdate(
            { partnerId: partner.id, userId: user._id },
            {
                $set: {
                    partnerId: partner.id,
                    partnerName: partner.name,
                    userId: user._id,
                    phoneNumber: normalizedPhone,
                    source: "REGISTERED",
                    status: "ACTIVE"
                }
            },
            {
                upsert: true,
                returnDocument: "after",
                session
            }
        );

        await session.commitTransaction();

        return {
            userId: user._id,
            partnerUserId: partnerUser._id,
            phoneNumber: normalizedPhone
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};
