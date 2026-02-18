import mongoose from "mongoose";
import User from "../../database/models/user.model.js";
import Wallet from "../../database/models/wallet.model.js";

const KENYA_PHONE_REGEX = /^\+254\d{9}$/;

export const registerUser = async (req, res) => {
  const { phone } = req.body;
  const normalizePhone = phone?.trim();

  if (!normalizePhone || !KENYA_PHONE_REGEX.test(normalizePhone)) {
    return res.status(400).json({
      success: false,
      error: "Invalid phone number",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.create(
      [{ phoneNumber: normalizePhone }],
      { session }
    );

    await Wallet.create(
      [{
        userId: user[0]._id,
        balance: 0,
        lastProcessedLedgerId: null,
      }],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      userId: user[0]._id,
    });

  } catch (error) {
    await session.abortTransaction();

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "User already exists",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Registration failed",
    });
  } finally {
    await session.endSession();
  }
};