import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma, recordMcpAudit } from '../lib/prisma';
import { addTool, err, ok } from '../lib/toolHelpers';

export const registerClinicTools = (server: McpServer) => {
    addTool(
        server,
        'list_clinics',
        'Lista todas as clínicas cadastradas no Planner com contagens de dentistas e pacientes.',
        {
            tenantId: z.string().uuid().optional().describe('Filtrar por ID do tenant'),
            search: z.string().optional().describe('Busca por nome, apelido, cidade ou CRO'),
        },
        async ({ tenantId, search }) => {
            const clinics = await prisma.clinic.findMany({
                where: {
                    ...(tenantId ? { tenantId } : {}),
                    ...(search
                        ? {
                              OR: [
                                  { name: { contains: search, mode: 'insensitive' } },
                                  { nickname: { contains: search, mode: 'insensitive' } },
                                  { city: { contains: search, mode: 'insensitive' } },
                                  { cro: { contains: search, mode: 'insensitive' } },
                              ],
                          }
                        : {}),
                },
                include: {
                    _count: { select: { dentists: true, patients: true } },
                },
                orderBy: { name: 'asc' },
            });

            return ok({ count: clinics.length, clinics });
        }
    );

    addTool(
        server,
        'get_clinic',
        'Obtém detalhes completos de uma clínica pelo ID, incluindo seus dentistas cadastrados.',
        {
            clinicId: z.string().uuid().describe('ID da clínica'),
        },
        async ({ clinicId }) => {
            const clinic = await prisma.clinic.findUnique({
                where: { id: clinicId },
                include: {
                    dentists: { orderBy: { name: 'asc' } },
                    _count: { select: { patients: true, userClinics: true } },
                },
            });
            if (!clinic) return err('Clínica não encontrada');
            return ok(clinic);
        }
    );

    addTool(
        server,
        'update_clinic',
        'Atualiza dados cadastrais de uma clínica (nome, apelido, CRO, endereço, website).',
        {
            clinicId: z.string().uuid().describe('ID da clínica'),
            name: z.string().min(1).optional(),
            nickname: z.string().nullable().optional(),
            cro: z.string().nullable().optional(),
            website: z.string().nullable().optional(),
            zipCode: z.string().nullable().optional(),
            street: z.string().nullable().optional(),
            number: z.string().nullable().optional(),
            complement: z.string().nullable().optional(),
            district: z.string().nullable().optional(),
            city: z.string().nullable().optional(),
            state: z.string().nullable().optional(),
        },
        async ({ clinicId, ...fields }) => {
            const existing = await prisma.clinic.findUnique({ where: { id: clinicId } });
            if (!existing) return err('Clínica não encontrada');

            const data = Object.fromEntries(
                Object.entries(fields).filter(([, value]) => value !== undefined)
            );
            if (Object.keys(data).length === 0) {
                return err('Nenhum campo fornecido para atualização');
            }

            const updated = await prisma.clinic.update({
                where: { id: clinicId },
                data,
            });

            await recordMcpAudit({
                tenantId: existing.tenantId,
                clinicId: existing.id,
                action: 'UPDATE',
                resource: 'CLINIC',
                resourceId: existing.id,
                details: { fields: Object.keys(data) },
            });

            return ok(updated);
        }
    );
};
