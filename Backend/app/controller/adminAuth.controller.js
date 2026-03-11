import Admin from "../../database/models/admin.model.js";
import AdminInvitation from "../../database/models/adminInvitation.model.js";
import {
    generateAdminToken,
    generateInvitationCode,
    generateSalt,
    hashPassword,
    hashToken
} from "../../service/adminAuth.service.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITATION_VALID_HOURS = 48; // Invitations valid for 48 hours

/**
 * CREATE ADMIN INVITATION (Admin-only)
 * Existing admin creates a time-limited invitation code for a new admin
 */
export const createAdminInvitation = async (req, res) => {
    try {
        // req.admin is set by verifyAdmin middleware
        if (!req.admin) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Authentication required"
            });
        }

        const { invitedEmail, invitedName, notes } = req.body;
        const normalizedEmail = invitedEmail?.trim().toLowerCase();

        if (!invitedName?.trim() || !normalizedEmail) {
            return res.status(400).json({
                status: "FAILED",
                reason: "invitedName and invitedEmail are required"
            });
        }

        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Invalid email format"
            });
        }

        // Check if admin already exists with this email
        const existing = await Admin.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(409).json({
                status: "FAILED",
                reason: "Admin with this email already exists"
            });
        }

        // Check if active invitation already exists for this email
        const activeInvitation = await AdminInvitation.findOne({
            invitedEmail: normalizedEmail,
            status: "PENDING",
            expiresAt: { $gt: new Date() }
        });

        if (activeInvitation) {
            return res.status(409).json({
                status: "FAILED",
                reason: "Active invitation already exists for this email"
            });
        }

        const invitationCode = generateInvitationCode();
        const expiresAt = new Date(Date.now() + INVITATION_VALID_HOURS * 60 * 60 * 1000);

        // Get inviting admin's info
        let invitingAdminId = req.admin.id || req.admin._id;
        if (req.admin.source === "ENV_TOKEN") {
            // ENV_TOKEN doesn't have database record; use null or special marker
            invitingAdminId = null;
        }

        const invitation = await AdminInvitation.create({
            invitationCode,
            invitedEmail: normalizedEmail,
            invitedName: invitedName.trim(),
            invitedBy: invitingAdminId,
            expiresAt,
            notes: notes?.trim() || ""
        });

        return res.status(201).json({
            status: "SUCCESS",
            invitation: {
                id: invitation._id,
                code: invitationCode,
                invitedEmail: invitation.invitedEmail,
                invitedName: invitation.invitedName,
                expiresAt: invitation.expiresAt,
                notes: "⚠️ Share this code with the invited admin. It expires in 48 hours and can only be used once."
            }
        });
    } catch (error) {
        console.error("[createAdminInvitation]", error);
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

/**
 * REGISTER ADMIN WITH INVITATION (Public but code-gated)
 * New admin uses invitation code to register
 */
export const registerAdminWithInvitation = async (req, res) => {
    try {
        const { invitationCode, password } = req.body;

        if (!invitationCode?.trim() || !password) {
            return res.status(400).json({
                status: "FAILED",
                reason: "invitationCode and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                status: "FAILED",
                reason: "Password must be at least 8 characters"
            });
        }

        // Validate that invitation exists, is pending, and not expired
        const invitation = await AdminInvitation.findOne({
            invitationCode: invitationCode.trim(),
            status: "PENDING"
        });

        if (!invitation) {
            return res.status(404).json({
                status: "FAILED",
                reason: "Invitation not found or already used"
            });
        }

        if (new Date() > invitation.expiresAt) {
            // Mark as expired by setting status (optional, but helps audit)
            invitation.status = "REVOKED";
            await invitation.save();
            return res.status(410).json({
                status: "FAILED",
                reason: "Invitation has expired"
            });
        }

        // Create the admin account
        const passwordSalt = generateSalt();
        const passwordHash = hashPassword(password, passwordSalt);
        const adminToken = generateAdminToken();
        const apiTokenHash = hashToken(adminToken);

        const admin = await Admin.create({
            name: invitation.invitedName,
            email: invitation.invitedEmail,
            passwordHash,
            passwordSalt,
            apiTokenHash,
            apiTokenIssuedAt: new Date(),
            lastLoginAt: new Date(),
            status: "ACTIVE"
        });

        // Mark invitation as used
        invitation.status = "USED";
        invitation.usedAt = new Date();
        invitation.usedByAdmin = admin._id;
        await invitation.save();

        return res.status(201).json({
            status: "SUCCESS",
            message: "Admin account created successfully",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email
            },
            token: adminToken
        });
    } catch (error) {
        console.error("[registerAdminWithInvitation]", error);
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

/**
 * LOGIN ADMIN
 * Email + password authentication (unchanged from before)
 */
export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();

        if (!normalizedEmail || !password) {
            return res.status(400).json({
                status: "FAILED",
                reason: "email and password are required"
            });
        }

        const admin = await Admin.findOne({ email: normalizedEmail });
        if (!admin) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid credentials"
            });
        }

        if (admin.status !== "ACTIVE") {
            return res.status(403).json({
                status: "FAILED",
                reason: "Admin account is suspended"
            });
        }

        const passwordHash = hashPassword(password, admin.passwordSalt);
        if (passwordHash !== admin.passwordHash) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Invalid credentials"
            });
        }

        const adminToken = generateAdminToken();
        admin.apiTokenHash = hashToken(adminToken);
        admin.apiTokenIssuedAt = new Date();
        admin.lastLoginAt = new Date();
        await admin.save();

        return res.json({
            status: "SUCCESS",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email
            },
            token: adminToken
        });
    } catch (error) {
        console.error("[loginAdmin]", error);
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

/**
 * LIST ADMIN INVITATIONS (Admin-only)
 * View pending and used invitations
 */
export const listAdminInvitations = async (req, res) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Authentication required"
            });
        }

        const { status = "PENDING" } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const invitations = await AdminInvitation.find(query)
            .select("invitationCode invitedEmail invitedName status expiresAt createdAt usedAt")
            .sort({ createdAt: -1 })
            .limit(100);

        return res.json({
            status: "SUCCESS",
            invitations: invitations.map(inv => ({
                id: inv._id,
                invitedEmail: inv.invitedEmail,
                invitedName: inv.invitedName,
                code: `${inv.invitationCode.slice(0, 8)}...${inv.invitationCode.slice(-8)}`, // Partial display
                status: inv.status,
                expiresAt: inv.expiresAt,
                usedAt: inv.usedAt,
                createdAt: inv.createdAt
            }))
        });
    } catch (error) {
        console.error("[listAdminInvitations]", error);
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};

/**
 * REVOKE ADMIN INVITATION (Admin-only)
 * Cancel a pending invitation before it's used
 */
export const revokeAdminInvitation = async (req, res) => {
    try {
        if (!req.admin) {
            return res.status(401).json({
                status: "FAILED",
                reason: "Authentication required"
            });
        }

        const { invitationId } = req.params;

        const invitation = await AdminInvitation.findById(invitationId);
        if (!invitation) {
            return res.status(404).json({
                status: "FAILED",
                reason: "Invitation not found"
            });
        }

        if (invitation.status !== "PENDING") {
            return res.status(409).json({
                status: "FAILED",
                reason: `Cannot revoke invitation with status: ${invitation.status}`
            });
        }

        invitation.status = "REVOKED";
        await invitation.save();

        return res.json({
            status: "SUCCESS",
            message: "Invitation revoked"
        });
    } catch (error) {
        console.error("[revokeAdminInvitation]", error);
        return res.status(500).json({
            status: "FAILED",
            reason: error.message
        });
    }
};
