import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        index: true
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },

    account: {
        type: String,
        required: true,
        enum: [
            "USER_SAVINGS",
            "OPERATOR_CLEARING",
            "BANK_SETTLEMENT"
        ]
    },

    amount: {
        type: Number,
        required: true
    },

    currency: {
        type: String,
        default: "KES"
    },

    reference: {
        type: String
    }

}, { timestamps: true });

const Ledger = mongoose.model("Ledger", ledgerSchema);

export default Ledger;