import express from 'express';
import { getPartnerAnalytics, getPartnerEvents, getPartnerSavingsBehavior, getPartnerUsers } from '../controller/partnerDashboard.controller.js';
import { verifyPartner } from '../middleware/partnerAuth.middleware.js';

const router = express.Router();

router.get('/events', verifyPartner, getPartnerEvents);
router.get('/analytics', verifyPartner, getPartnerAnalytics);
router.get('/savings-behavior', verifyPartner, getPartnerSavingsBehavior);
router.get('/users', verifyPartner, getPartnerUsers);

export default router;
