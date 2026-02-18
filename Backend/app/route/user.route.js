import express from 'express';
import { registerUser } from '../controller/registration.controller.js';

const router = express.Router();

router.post('/', registerUser);

export default router;