import express from "express";
import Joi from "joi";
import { validateBody } from "../middleware/validation.middleware.js";
import {
    registerPartnerAuth,
    loginPartnerAuth,
    refreshPartnerToken
} from "../controller/partnerAuth.controller.js";

const router = express.Router();

const registrationSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(10).required(),
    webhookUrl: Joi.string().uri().allow("", null),
    operatingMode: Joi.string().valid("demo", "live").default("demo")
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

router.post("/register", validateBody(registrationSchema), registerPartnerAuth);
router.post("/login", validateBody(loginSchema), loginPartnerAuth);
router.post("/refresh", refreshPartnerToken);

export default router;
