import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const loadEnvIfMissing = () => {
    if (process.env.DATABASE_URL) return;

    const candidates = [
        path.resolve(__dirname, '../../.env'),
        path.resolve(__dirname, '../../../backend/.env'),
        path.resolve(__dirname, '../../../.env'),
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'backend/.env'),
    ];

    for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
            dotenv.config({ path: filePath, quiet: true } as any);
            if (process.env.DATABASE_URL) break;
        }
    }
};

loadEnvIfMissing();

export const prisma = new PrismaClient({
    log: ['error'],
});

export interface McpAuditEntry {
    tenantId?: string | null;
    clinicId?: string | null;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    resource: 'PATIENT' | 'PLANNING' | 'CONTRACT' | 'TREATMENT' | 'CLINIC';
    resourceId?: string | null;
    details?: unknown;
}

/**
 * Persists an audit trail entry for mutations triggered through the MCP server.
 */
export const recordMcpAudit = async (entry: McpAuditEntry): Promise<void> => {
    try {
        await prisma.auditLog.create({
            data: {
                tenantId: entry.tenantId ?? null,
                clinicId: entry.clinicId ?? null,
                userName: process.env.MCP_ACTOR_NAME || 'MCP Server',
                userEmail: 'mcp@local',
                action: entry.action,
                resource: entry.resource,
                resourceId: entry.resourceId ?? null,
                details: entry.details !== undefined ? (entry.details as any) : undefined,
                userAgent: 'ortho-ai-planner-mcp/1.0.0',
            },
        });
    } catch (error) {
        console.error('[MCP AuditLog] Failed to record audit entry:', error);
    }
};

