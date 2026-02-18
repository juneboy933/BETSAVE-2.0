import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    apiKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    apiSecret: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'SUSPENDED'],
        default: 'ACTIVE'
    },
    webhookUrl: {
        type: String,
        default: null
    }
}, { timestamps: true });

const Partner = mongoose.model('Partner', partnerSchema);

export default Partner;