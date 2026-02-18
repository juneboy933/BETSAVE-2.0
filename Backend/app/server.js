import express from 'express';
import userRoutes from './route/user.route.js';
import partnerRoutes from './route/partner.route.js';
import partnerDashboardRoutes from './route/partnerDashboard.route.js';
import userDashboardRoutes from './route/userDashboard.route.js';
import adminDashboardRoutes from './route/adminDashboard.route.js';
import adminAuthRoutes from './route/adminAuth.route.js';
import dotenv from 'dotenv';
import { connectDB } from '../database/config.js';

dotenv.config();
const PORT = process.env.PORT;
const app = express();

app.use(express.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-signature, x-timestamp, x-user-phone, x-admin-token");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

// Health check
app.get('/health', (_, res) => {
    res.status(200).json({
        status: 'OK',
        service: 'BETSAVE CORE',
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

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        error: "Internal Server Error"
    });
});

// Start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
