import express from "express";
import {
    getUserDashboardSummary,
    getUserEvents,
    getUserTransactions
} from "../controller/userDashboard.controller.js";
import { verifyUserToken } from "../middleware/userAuth.middleware.js";

const router = express.Router();

router.get("/:userId", verifyUserToken, getUserDashboardSummary);
router.get("/:userId/events", verifyUserToken, getUserEvents);
router.get("/:userId/transactions", verifyUserToken, getUserTransactions);

export default router;
