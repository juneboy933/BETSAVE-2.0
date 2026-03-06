import express from "express";
import {
    createDeposit,
    createWithdrawal,
    getUserPaymentTransactions,
    getPaymentTransactionById,
    handleDepositCallback,
    handleWithdrawalCallback
} from "../controller/payment.controller.js";
import { verifyUserPhone } from "../middleware/userAuth.middleware.js";

const router = express.Router();

router.post("/:userId/deposits", verifyUserPhone, createDeposit);
router.post("/:userId/withdrawals", verifyUserPhone, createWithdrawal);
router.get("/:userId/transactions", verifyUserPhone, getUserPaymentTransactions);
router.get("/:userId/transactions/:paymentTransactionId", verifyUserPhone, getPaymentTransactionById);

router.post("/callbacks/deposit", handleDepositCallback);
router.post("/callbacks/withdrawal", handleWithdrawalCallback);

export default router;
