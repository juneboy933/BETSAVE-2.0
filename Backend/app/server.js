import express from 'express';
import userRoutes from './route/user.route.js';
import partnerRoutes from './route/partner.route.js';
import partnerDashboardRoutes from './route/partnerDashboard.route.js';
import userDashboardRoutes from './route/userDashboard.route.js';
import adminDashboardRoutes from './route/adminDashboard.route.js';
import adminAuthRoutes from './route/adminAuth.route.js';
import paymentRoutes from './route/payment.route.js';
import dotenv from 'dotenv';
import { connectDB, isDatabaseReady } from '../database/config.js';
import { validatePaymentConfiguration } from '../service/validatePaymentConfig.service.js';
import { validatePartnerModeConfiguration } from './middleware/partnerMode.middleware.js';

dotenv.config();
const PORT = process.env.PORT;
const app = express();

app.use(express.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-signature, x-timestamp, x-user-phone, x-admin-token, x-callback-token, x-integration-token");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

// Health check
app.get('/health', (_, res) => {
    const dbReady = isDatabaseReady();
    res.status(dbReady ? 200 : 503).json({
        status: dbReady ? 'OK' : 'DEGRADED',
        service: 'BETSAVE CORE',
        database: dbReady ? 'UP' : 'DOWN',
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/v1/register', userRoutes);
app.use('/api/v1/partners', partnerRoutes);
app.use('/api/v1/dashboard', partnerDashboardRoutes);
app.use('/api/v1/dashboard/partner', partnerDashboardRoutes);
app.use('/api/v1/dashboard/user', userDashboardRoutes);
app.use('/api/v1/dashboard/admin', adminDashboardRoutes);
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        error: "Internal Server Error"
    });
});

// Start server
try {
    const partnerModeConfig = validatePartnerModeConfiguration();
    console.log(
        `[startup] Partner mode=${partnerModeConfig.mode} (integrationTokenRequired=${partnerModeConfig.integrationTokenRequired})`
    );

    const paymentConfig = validatePaymentConfiguration();
    if (paymentConfig.depositsEnabled || paymentConfig.withdrawalsEnabled) {
        console.log(
            `[startup] Payments config OK (env=${paymentConfig.env}, deposits=${paymentConfig.depositsEnabled}, withdrawals=${paymentConfig.withdrawalsEnabled})`
        );
    } else {
        console.log("[startup] Payments disabled (both deposits and withdrawals are OFF)");
    }
} catch (error) {
    console.error(`[startup] Payment configuration error: ${error.message}`);
    process.exit(1);
}

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error(`[startup] Database connection failed: ${error.message}`);
        process.exit(1);
    });
