import mongoose from "mongoose";
import User from "../../database/models/user.model.js";

export const verifyUserPhone = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const userPhone = req.headers["x-user-phone"];

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid user id"
            });
        }

        if (!userPhone || typeof userPhone !== "string") {
            return res.status(401).json({
                status: "FAILED",
                reason: "Missing user phone"
            });
        }

        const user = await User.findById(userId).select("phoneNumber");
        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                reason: "User not found"
            });
        }

        if (user.phoneNumber !== userPhone.trim()) {
            return res.status(403).json({
                status: "FAILED",
                reason: "User access denied"
            });
        }

        req.user = {
            id: user._id.toString(),
            phoneNumber: user.phoneNumber
        };
        next();
    } catch (error) {
        return res.status(500).json({
            status: "FAILED",
            reason: "User verification failed"
        });
    }
};
