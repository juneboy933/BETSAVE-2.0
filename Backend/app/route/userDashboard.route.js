import express from "express";
import {
    getUserDashboardSummary,
    getUserEvents,
    getUserTransactions
} from "../controller/userDashboard.controller.js";
import { verifyUserPhone } from "../middleware/userAuth.middleware.js";

const router = express.Router();

router.get("/:userId", verifyUserPhone, getUserDashboardSummary);
router.get("/:userId/events", verifyUserPhone, getUserEvents);
router.get("/:userId/transactions", verifyUserPhone, getUserTransactions);

export default router;
