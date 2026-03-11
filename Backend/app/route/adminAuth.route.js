import express from "express";
import {
    createAdminInvitation,
    listAdminInvitations,
    loginAdmin,
    registerAdminWithInvitation,
    revokeAdminInvitation
} from "../controller/adminAuth.controller.js";
import { verifyAdmin } from "../middleware/adminAuth.middleware.js";

const router = express.Router();

// Public routes (no protection)
router.post("/login", loginAdmin);
router.post("/register-with-invitation", registerAdminWithInvitation);

// Admin-only routes (require valid admin token)
router.post("/invitations", verifyAdmin, createAdminInvitation);
router.get("/invitations", verifyAdmin, listAdminInvitations);
router.delete("/invitations/:invitationId", verifyAdmin, revokeAdminInvitation);

export default router;
