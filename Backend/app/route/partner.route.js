import express from 'express';
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
router.post('/events', verifyPartner, requirePartnerIntegrationInLiveMode, postEvent);
router.post('/users/register', verifyPartner, requirePartnerIntegrationInLiveMode, registerUserFromPartner);
router.post('/users/verify-otp', verifyPartner, requirePartnerIntegrationInLiveMode, verifyPartnerUserOtp);

export default router;
