import mongoose from "mongoose";
import Admin from "../database/models/admin.model.js";

const selectAdminPermissionFields = "_id isPrimaryAdmin";

export const canAdminManageInvitations = async (adminId) => {
    if (!mongoose.Types.ObjectId.isValid(adminId)) {
        return false;
    }

    const admin = await Admin.findById(adminId).select(selectAdminPermissionFields).lean();
    if (!admin) {
        return false;
    }

    return Boolean(admin.isPrimaryAdmin);
};
