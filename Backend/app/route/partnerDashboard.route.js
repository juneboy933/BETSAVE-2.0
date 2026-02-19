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
import { verifyPartner } from '../middleware/partnerAuth.middleware.js';

const router = express.Router();

router.get('/events', verifyPartner, getPartnerEvents);
router.get('/analytics', verifyPartner, getPartnerAnalytics);
router.get('/savings-behavior', verifyPartner, getPartnerSavingsBehavior);
router.get('/users', verifyPartner, getPartnerUsers);
router.get('/notifications', verifyPartner, getPartnerNotifications);
router.get('/notifications/summary', verifyPartner, getPartnerNotificationSummary);
router.patch('/notifications/read-all', verifyPartner, markPartnerNotificationsRead);

export default router;
