import mongoose from "mongoose";

const discrepancySchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        trim: true
    },
    expectedAmount: {
        type: Number,
        required: true,
        default: 0
    },
    providerAmount: {
        type: Number,
        required: true,
        default: 0
    },
    variance: {
        type: Number,
        required: true,
        default: 0
    },
    notes: {
        type: String,
        trim: true,
        default: null
    }
}, { _id: false });

const reconciliationRunSchema = new mongoose.Schema({
    runDate: {
        type: Date,
        required: true,
        index: true
    },

    status: {
        type: String,
        required: true,
        enum: ["PENDING", "COMPLETED", "FAILED"],
        default: "PENDING"
    },

    expectedTotal: {
        type: Number,
        required: true,
        default: 0
    },

    providerTotal: {
        type: Number,
        required: true,
        default: 0
    },

    variance: {
        type: Number,
        required: true,
        default: 0
    },

    discrepancies: {
        type: [discrepancySchema],
        default: []
    }
}, { timestamps: true });

reconciliationRunSchema.index({ runDate: 1, createdAt: -1 });

const ReconciliationRun = mongoose.model("ReconciliationRun", reconciliationRunSchema);

export default ReconciliationRun;
