import mongoose from "mongoose";

const partnerUserSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Partner",
            required: true,
            index: true
        },
        partnerName: {
            type: String,
            required: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        phoneNumber: {
            type: String,
            required: true,
            index: true
        },
        source: {
            type: String,
            enum: ["REGISTERED", "INFERRED"],
            default: "REGISTERED"
        },
        status: {
            type: String,
            enum: ["ACTIVE", "SUSPENDED"],
            default: "ACTIVE"
        }
    },
    { timestamps: true }
);

partnerUserSchema.index({ partnerId: 1, userId: 1 }, { unique: true });
partnerUserSchema.index({ partnerId: 1, phoneNumber: 1 }, { unique: true });

const PartnerUser = mongoose.model("PartnerUser", partnerUserSchema);

export default PartnerUser;
