import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        default: null,
    },
    phone: {
        type: String,
        required: true,
    },
    partnerName: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
        default: 'BET_PLACED',
    },
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    status: {
        type: String,
        enum: ['RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED'],
        default: 'RECEIVED'
    }
}, { timestamps: true });

eventSchema.index({ partnerName: 1, eventId: 1 }, { unique: true });
eventSchema.index({ userId: 1, createdAt: -1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;
