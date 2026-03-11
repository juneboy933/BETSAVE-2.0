import Joi from 'joi';
import dotenv from 'dotenv';

// load .env at project root if present
dotenv.config();

const envSchema = Joi.object({
    PORT: Joi.number().integer().min(1).max(65535).required(),
    MONGO_URI: Joi.string().uri().required(),
    REDIS_URI: Joi.string().uri().required(),

    // optional operational settings
    SAVINGS_PERCENTAGE: Joi.number().min(0).max(1).default(0.1),

    ADMIN_DASHBOARD_TOKEN: Joi.string().min(10).required(),
    PARTNER_OPERATING_MODE: Joi.string().valid('demo','live').default('demo'),
    PARTNER_INTEGRATION_TOKEN: Joi.string().min(10).allow('', null),
    PARTNER_JWT_SECRET: Joi.string().min(32).required(),

    // CORS origins whitelist (comma-separated)
    CORS_ALLOWED_ORIGINS: Joi.string().allow('').default(''),

    // user authentication
    USER_JWT_SECRET: Joi.string().min(32).required(),
    USER_JWT_EXPIRATION: Joi.string().default('7d'),


    // external services
    BANK_API_URL: Joi.string().uri().allow('', null),
    BANK_API_KEY: Joi.string().allow('', null),
    BANK_SETTLEMENT_ACCOUNT: Joi.string().allow('', null),
    PAYMENT_CALLBACK_TOKEN: Joi.string().min(8).allow('', null),

    DARAJA_ENV: Joi.string().valid('sandbox','production').default('sandbox'),
    DARAJA_HTTP_TIMEOUT_MS: Joi.number().integer().min(1000).default(20000),

    // redis auth
    REDIS_PASSWORD: Joi.string().allow('', null)
}).unknown(); // allow other vars

const { value: env, error } = envSchema.validate(process.env, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true
});

if (error) {
    console.error('Environment validation error:', error.details.map(d => d.message).join(', '));
    process.exit(1);
}

export default env;
