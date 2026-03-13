import express from 'express';
import Joi from 'joi';
import { validateBody } from '../middleware/validation.middleware.js';
import {
    getPartnerOperatingMode,
    registerUserFromPartner,
    setPartnerOperatingMode,
    verifyPartnerUserOtp
} from '../controller/partner.controller.js';
import { verifyPartnerDashboard } from '../middleware/partnerDashboardAuth.middleware.js';
import { requirePartnerIntegrationInLiveMode } from '../middleware/partnerMode.middleware.js';
import { postEvent } from '../controller/event.controller.js';

const router = express.Router();

router.get('/mode', verifyPartnerDashboard, getPartnerOperatingMode);
router.patch('/mode', verifyPartnerDashboard, setPartnerOperatingMode);
const eventSchema = Joi.object({
    eventId: Joi.string().required(),
    phone: Joi.string().pattern(/^\+254\d{9}$/).required(),
    amount: Joi.number().positive().required(),
    type: Joi.string().optional()
});

const newPartnerUserSchema = Joi.object({
    phone: Joi.string().pattern(/^\+254\d{9}$/).required(),
    autoSavingsEnabled: Joi.boolean().optional()
});

const verifyPartnerOtpSchema = Joi.object({
    phone: Joi.string().pattern(/^\+254\d{9}$/).required(),
    otp: Joi.string().min(4).max(6).required()
});

router.post(
    '/events',
    verifyPartnerDashboard,
    requirePartnerIntegrationInLiveMode,
    validateBody(eventSchema),
    postEvent
);
router.post(
    '/users/register',
    verifyPartnerDashboard,
    requirePartnerIntegrationInLiveMode,
    validateBody(newPartnerUserSchema),
    registerUserFromPartner
);
router.post(
    '/users/verify-otp',
    verifyPartnerDashboard,
    requirePartnerIntegrationInLiveMode,
    validateBody(verifyPartnerOtpSchema),
    verifyPartnerUserOtp
);

export default router;
