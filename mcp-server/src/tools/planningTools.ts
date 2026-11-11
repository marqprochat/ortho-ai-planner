import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, recordMcpAudit } from '../lib/prisma';
import { addTool, err, ok } from '../lib/toolHelpers';

export const registerPlanningTools = (server: McpServer) => {
    addTool(
        server,
        'list_plannings',
        'Lista planejamentos ortodônticos com filtros por clínica, paciente, dentista, status ou apenas sem dentista vinculado.',
        {
            clinicId: z.string().uuid().optional(),
            patientId: z.string().uuid().optional(),
            dentistId: z.string().uuid().optional(),
            status: z.string().optional(),
            unlinkedDentistOnly: z.boolean().optional().default(false),
            search: z.string().optional(),
            limit: z.number().int().min(1).max(200).optional().default(50),
            offset: z.number().int().min(0).optional().default(0),
        },
        async ({ clinicId, patientId, dentistId, status, unlinkedDentistOnly, search, limit, offset }) => {
            const where: Prisma.PlanningWhereInput = {
                ...(patientId ? { patientId } : {}),
                ...(status ? { status } : {}),
                ...(unlinkedDentistOnly ? { dentistId: null } : dentistId ? { dentistId } : {}),
                ...(clinicId ? { patient: { clinicId } } : {}),
                ...(search
                    ? {
                          OR: [
                              { title: { contains: search, mode: 'insensitive' } },
                              { patient: { name: { contains: search, mode: 'insensitive' } } },
                          ],
                      }
                    : {}),
            };

            const [total, plannings] = await Promise.all([
                prisma.planning.count({ where }),
                prisma.planning.findMany({
                    where,
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        patientId: true,
                        dentistId: true,
                        structuredPlan: true,
                        createdAt: true,
                        updatedAt: true,
                        patient: { select: { id: true, name: true, clinicId: true } },
                        dentist: { select: { id: true, name: true, cro: true } },
                        treatment: { select: { id: true, status: true, dentistId: true, doctorName: true } },
                        _count: { select: { contracts: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset,
                }),
            ]);

            return ok({ total, count: plannings.length, offset, limit, plannings });
        }
    );

    addTool(
        server,
        'get_planning',
        'Obtém um planejamento completo pelo ID (relatório original, resposta IA, structuredPlan, dentista, tratamento e contratos).',
        {
            planningId: z.string().uuid(),
        },
        async ({ planningId }) => {
            const planning = await prisma.planning.findUnique({
                where: { id: planningId },
                include: {
                    patient: { select: { id: true, name: true, clinicId: true, tenantId: true } },
                    dentist: true,
                    treatment: true,
                    contracts: true,
                },
            });
            if (!planning) return err('Planejamento não encontrado');
            return ok(planning);
        }
    );

    addTool(
        server,
        'create_planning',
        'Cria um planejamento para um paciente (validando se o dentistId pertence à mesma clínica).',
        {
            patientId: z.string().uuid(),
            title: z.string().min(1),
            status: z.string().optional().default('DRAFT'),
            originalReport: z.string().nullable().optional(),
            aiResponse: z.string().nullable().optional(),
            structuredPlan: z.record(z.unknown()).nullable().optional(),
            dentistId: z.string().uuid().nullable().optional(),
        },
        async ({ patientId, title, status, originalReport, aiResponse, structuredPlan, dentistId }) => {
            const patient = await prisma.patient.findUnique({ where: { id: patientId } });
            if (!patient) return err('Paciente não encontrado');

            let validDentist: { id: string; name: string; cro: string } | null = null;
            if (dentistId) {
                validDentist = await prisma.dentist.findFirst({
                    where: { id: dentistId, clinicId: patient.clinicId, isActive: true },
                    select: { id: true, name: true, cro: true },
                });
                if (!validDentist) return err('Dentista inválido ou inativo para a clínica do paciente');
            }

            const mergedStructuredPlan =
                structuredPlan && validDentist
                    ? {
                          ...structuredPlan,
                          dentistId: validDentist.id,
                          nomeOrtodontista: validDentist.name,
                          croOrtodontista: validDentist.cro,
                      }
                    : structuredPlan;

            const planning = await prisma.planning.create({
                data: {
                    patientId,
                    title,
                    status,
                    originalReport: originalReport ?? null,
                    aiResponse: aiResponse ?? null,
                    structuredPlan: mergedStructuredPlan
                        ? (mergedStructuredPlan as Prisma.InputJsonValue)
                        : Prisma.JsonNull,
                    dentistId: validDentist?.id ?? null,
                },
            });

            await recordMcpAudit({
                tenantId: patient.tenantId,
                clinicId: patient.clinicId,
                action: 'CREATE',
                resource: 'PLANNING',
                resourceId: planning.id,
                details: { title: planning.title, dentistId: planning.dentistId },
            });

            return ok(planning);
        }
    );

    addTool(
        server,
        'update_planning',
        'Atualiza campos de um planejamento (título, status, relatório, IA, structuredPlan ou dentistId).',
        {
            planningId: z.string().uuid(),
            title: z.string().min(1).optional(),
            status: z.string().optional(),
            originalReport: z.string().nullable().optional(),
            aiResponse: z.string().nullable().optional(),
            structuredPlan: z.record(z.unknown()).nullable().optional(),
            dentistId: z.string().uuid().nullable().optional(),
        },
        async ({ planningId, dentistId, structuredPlan, ...fields }) => {
            const existing = await prisma.planning.findUnique({
                where: { id: planningId },
                include: { patient: { select: { clinicId: true, tenantId: true } } },
            });
            if (!existing) return err('Planejamento não encontrado');

            let dentistUpdate: { dentistId?: string | null } = {};
            let resolvedDentist: { id: string; name: string; cro: string } | null = null;
            if (dentistId === null) {
                dentistUpdate = { dentistId: null };
            } else if (typeof dentistId === 'string') {
                resolvedDentist = await prisma.dentist.findFirst({
                    where: { id: dentistId, clinicId: existing.patient.clinicId },
                    select: { id: true, name: true, cro: true },
                });
                if (!resolvedDentist) return err('Dentista não pertence à clínica deste paciente');
                dentistUpdate = { dentistId: resolvedDentist.id };
            }

            const baseStructured =
                structuredPlan !== undefined
                    ? structuredPlan
                    : existing.structuredPlan && typeof existing.structuredPlan === 'object' && !Array.isArray(existing.structuredPlan)
                      ? (existing.structuredPlan as Record<string, unknown>)
                      : null;

            let nextStructuredPlan: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined = undefined;
            if (structuredPlan === null) {
                nextStructuredPlan = Prisma.JsonNull;
            } else if (baseStructured && resolvedDentist) {
                nextStructuredPlan = {
                    ...baseStructured,
                    dentistId: resolvedDentist.id,
                    nomeOrtodontista: resolvedDentist.name,
                    croOrtodontista: resolvedDentist.cro,
                } as Prisma.InputJsonValue;
            } else if (structuredPlan !== undefined) {
                nextStructuredPlan = structuredPlan as Prisma.InputJsonValue;
            }

            const updated = await prisma.planning.update({
                where: { id: planningId },
                data: {
                    ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
                    ...(nextStructuredPlan !== undefined ? { structuredPlan: nextStructuredPlan } : {}),
                    ...dentistUpdate,
                },
            });

            await recordMcpAudit({
                tenantId: existing.patient.tenantId,
                clinicId: existing.patient.clinicId,
                action: 'UPDATE',
                resource: 'PLANNING',
                resourceId: updated.id,
                details: { dentistId: updated.dentistId, status: updated.status },
            });

            return ok(updated);
        }
    );

    addTool(
        server,
        'delete_planning',
        'Exclui um planejamento (exige confirm: true).',
        {
            planningId: z.string().uuid(),
            confirm: z.boolean(),
        },
        async ({ planningId, confirm }) => {
            if (!confirm) return err('Operação exige confirm: true');

            const existing = await prisma.planning.findUnique({
                where: { id: planningId },
                include: { patient: { select: { clinicId: true, tenantId: true } } },
            });
            if (!existing) return err('Planejamento não encontrado');

            await prisma.planning.delete({ where: { id: planningId } });

            await recordMcpAudit({
                tenantId: existing.patient.tenantId,
                clinicId: existing.patient.clinicId,
                action: 'DELETE',
                resource: 'PLANNING',
                resourceId: existing.id,
                details: { title: existing.title },
            });

            return ok({ deleted: true, planningId });
        }
    );
};
