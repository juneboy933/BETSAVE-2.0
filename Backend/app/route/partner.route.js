import express from 'express';
import { createPartner, loginPartner, registerUserFromPartner } from '../controller/partner.controller.js';
import { verifyPartner } from '../middleware/partnerAuth.middleware.js';
import { postEvent } from '../controller/event.controller.js';

const router = express.Router();

router.post('/create', createPartner);
router.post('/login', loginPartner);
router.post('/events', verifyPartner, postEvent);
router.post('/users/register', verifyPartner, registerUserFromPartner);

export default router;
