import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { addTool, ok } from '../lib/toolHelpers';

export const registerReportTools = (server: McpServer) => {
    addTool(
        server,
        'get_planner_summary',
        'Retorna visão geral do Planner (totais de pacientes, dentistas, planejamentos, tratamentos, contratos e registros sem dentista vinculado).',
        {
            clinicId: z.string().uuid().optional().describe('ID da clínica (opcional; se omitido, agrega todas)'),
        },
        async ({ clinicId }) => {
            const patientFilter = clinicId ? { clinicId } : {};
            const treatmentClinicFilter = clinicId
                ? { OR: [{ patient: { clinicId } }, { planning: { patient: { clinicId } } }] }
                : {};

            const [
                dentistsActive,
                dentistsInactive,
                patientsTotal,
                planningsTotal,
                planningsWithoutDentist,
                treatmentsTotal,
                treatmentsWithoutDentist,
                contractsTotal,
                contractsSigned,
                treatmentStatuses,
                planningStatuses,
            ] = await Promise.all([
                prisma.dentist.count({ where: { ...(clinicId ? { clinicId } : {}), isActive: true } }),
                prisma.dentist.count({ where: { ...(clinicId ? { clinicId } : {}), isActive: false } }),
                prisma.patient.count({ where: patientFilter }),
                prisma.planning.count({ where: { patient: patientFilter } }),
                prisma.planning.count({ where: { dentistId: null, patient: patientFilter } }),
                prisma.treatment.count({ where: treatmentClinicFilter }),
                prisma.treatment.count({ where: { dentistId: null, ...treatmentClinicFilter } }),
                prisma.contract.count({ where: { patient: patientFilter } }),
                prisma.contract.count({ where: { isSigned: true, patient: patientFilter } }),
                prisma.treatment.groupBy({
                    by: ['status'],
                    where: treatmentClinicFilter,
                    _count: { _all: true },
                }),
                prisma.planning.groupBy({
                    by: ['status'],
                    where: { patient: patientFilter },
                    _count: { _all: true },
                }),
            ]);

            return ok({
                clinicId: clinicId ?? 'ALL',
                dentists: { active: dentistsActive, inactive: dentistsInactive },
                patients: { total: patientsTotal },
                plannings: {
                    total: planningsTotal,
                    withoutDentistId: planningsWithoutDentist,
                    byStatus: Object.fromEntries(planningStatuses.map((s) => [s.status, s._count._all])),
                },
                treatments: {
                    total: treatmentsTotal,
                    withoutDentistId: treatmentsWithoutDentist,
                    byStatus: Object.fromEntries(treatmentStatuses.map((s) => [s.status, s._count._all])),
                },
                contracts: {
                    total: contractsTotal,
                    signed: contractsSigned,
                    pending: contractsTotal - contractsSigned,
                },
            });
        }
    );

    addTool(
        server,
        'list_users',
        'Lista usuários do sistema (sem expor senhas), útil para obter userId ao criar pacientes.',
        {
            tenantId: z.string().uuid().optional(),
            clinicId: z.string().uuid().optional(),
        },
        async ({ tenantId, clinicId }) => {
            const users = await prisma.user.findMany({
                where: {
                    ...(tenantId ? { tenantId } : {}),
                    ...(clinicId ? { userClinics: { some: { clinicId } } } : {}),
                },
                select: {
                    id: true,
                    name: true,
                    nickname: true,
                    email: true,
                    cro: true,
                    tenantId: true,
                    isSuperAdmin: true,
                },
                orderBy: { name: 'asc' },
            });
            return ok({ count: users.length, users });
        }
    );

    addTool(
        server,
        'list_audit_logs',
        'Consulta logs de auditoria recentes do sistema (incluindo alterações feitas via MCP).',
        {
            clinicId: z.string().uuid().optional(),
            resource: z.string().optional(),
            action: z.string().optional(),
            limit: z.number().int().min(1).max(200).optional().default(30),
        },
        async ({ clinicId, resource, action, limit }) => {
            const logs = await prisma.auditLog.findMany({
                where: {
                    ...(clinicId ? { clinicId } : {}),
                    ...(resource ? { resource } : {}),
                    ...(action ? { action } : {}),
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
            return ok({ count: logs.length, logs });
        }
    );
};
