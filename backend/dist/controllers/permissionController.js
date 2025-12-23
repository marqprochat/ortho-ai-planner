"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPermissions = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getPermissions = async (req, res) => {
    try {
        const permissions = await prisma_1.default.permission.findMany({
            include: { application: true }
        });
        res.json(permissions);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
};
exports.getPermissions = getPermissions;
