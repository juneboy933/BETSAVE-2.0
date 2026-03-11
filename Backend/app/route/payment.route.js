import express from "express";
import {
    createDeposit,
    createWithdrawal,
    getUserPaymentTransactions,
    getPaymentTransactionById,
    handleDepositCallback,
    handleWithdrawalCallback
} from "../controller/payment.controller.js";
import { verifyUserToken } from "../middleware/userAuth.middleware.js";

const router = express.Router();

router.post("/:userId/deposits", verifyUserToken, createDeposit);
router.post("/:userId/withdrawals", verifyUserToken, createWithdrawal);
router.get("/:userId/transactions", verifyUserToken, getUserPaymentTransactions);
router.get("/:userId/transactions/:paymentTransactionId", verifyUserToken, getPaymentTransactionById);

router.post("/callbacks/deposit", handleDepositCallback);
router.post("/callbacks/withdrawal", handleWithdrawalCallback);

export default router;
