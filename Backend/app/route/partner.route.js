import express from 'express';
import Joi from 'joi';
import { validateBody } from '../middleware/validation.middleware.js';
import {
    createPartner,
    getPartnerCredentials,
    getPartnerOperatingMode,
    loginPartner,
    registerUserFromPartner,
    setPartnerOperatingMode,
    verifyPartnerUserOtp
} from '../controller/partner.controller.js';
import { verifyPartner } from '../middleware/partnerAuth.middleware.js';
import { requirePartnerIntegrationInLiveMode } from '../middleware/partnerMode.middleware.js';
import { postEvent } from '../controller/event.controller.js';

const router = express.Router();

router.post('/create', createPartner);
router.post('/login', loginPartner);
router.get('/credentials', verifyPartner, getPartnerCredentials);
router.get('/mode', verifyPartner, getPartnerOperatingMode);
router.patch('/mode', verifyPartner, setPartnerOperatingMode);
const eventSchema = Joi.object({
    eventId: Joi.string().required(),
    phone: Joi.string().pattern(/^\+254\d{9}$/).required(),
    amount: Joi.number().positive().required(),
    type: Joi.string().optional()
});

const newPartnerUserSchema = Joi.object({
    phone: Joi.string().pattern(/^\+254\d{9}$/).required()
});

router.post(
    '/events',
    verifyPartner,
    requirePartnerIntegrationInLiveMode,
    validateBody(eventSchema),
    postEvent
);
router.post(
    '/users/register',
    verifyPartner,
    requirePartnerIntegrationInLiveMode,
    validateBody(newPartnerUserSchema),
    registerUserFromPartner
);
router.post('/users/verify-otp', verifyPartner, requirePartnerIntegrationInLiveMode, validateBody(newPartnerUserSchema), verifyPartnerUserOtp);

export default router;
