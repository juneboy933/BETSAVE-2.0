import express from 'express';
import {
    getPartnerAnalytics,
    getPartnerEvents,
    getPartnerNotificationSummary,
    getPartnerNotifications,
    getPartnerSavingsBehavior,
    getPartnerUsers,
    markPartnerNotificationsRead
} from '../controller/partnerDashboard.controller.js';
import { verifyPartnerDashboard } from '../middleware/partnerDashboardAuth.middleware.js';

const router = express.Router();

router.get('/events', verifyPartnerDashboard, getPartnerEvents);
router.get('/analytics', verifyPartnerDashboard, getPartnerAnalytics);
router.get('/savings-behavior', verifyPartnerDashboard, getPartnerSavingsBehavior);
router.get('/users', verifyPartnerDashboard, getPartnerUsers);
router.get('/notifications', verifyPartnerDashboard, getPartnerNotifications);
router.get('/notifications/summary', verifyPartnerDashboard, getPartnerNotificationSummary);
router.patch('/notifications/read-all', verifyPartnerDashboard, markPartnerNotificationsRead);

export default router;
