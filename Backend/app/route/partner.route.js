import express from 'express';
import { createPartner, getPartnerCredentials, loginPartner, registerUserFromPartner, verifyPartnerUserOtp } from '../controller/partner.controller.js';
import { verifyPartner } from '../middleware/partnerAuth.middleware.js';
import { postEvent } from '../controller/event.controller.js';

const router = express.Router();

router.post('/create', createPartner);
router.post('/login', loginPartner);
router.get('/credentials', verifyPartner, getPartnerCredentials);
router.post('/events', verifyPartner, postEvent);
router.post('/users/register', verifyPartner, registerUserFromPartner);
router.post('/users/verify-otp', verifyPartner, verifyPartnerUserOtp);

export default router;
