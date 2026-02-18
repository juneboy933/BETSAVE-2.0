import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true
    },
    verified: {
        type: Boolean,
        default: false,
    },
    identity: {
        type: Object
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACTIVE', 'SUSPENDED'],
        default: 'PENDING'
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;