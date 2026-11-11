import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, recordMcpAudit } from '../lib/prisma';
import { addTool, err, ok, parseOptionalDate } from '../lib/toolHelpers';

export const registerTreatmentTools = (server: McpServer) => {
    addTool(
        server,
        'list_treatments',
        'Lista tratamentos com filtros por clínica, paciente, dentista, status ou apenas sem dentista vinculado.',
        {
            clinicId: z.string().uuid().optional(),
            patientId: z.string().uuid().optional(),
            dentistId: z.string().uuid().optional(),
            status: z.enum(['EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO']).optional(),
            unlinkedDentistOnly: z.boolean().optional().default(false),
            search: z.string().optional().describe('Busca por nome do paciente ou doctorName'),
            limit: z.number().int().min(1).max(200).optional().default(50),
            offset: z.number().int().min(0).optional().default(0),
        },
        async ({ clinicId, patientId, dentistId, status, unlinkedDentistOnly, search, limit, offset }) => {
            const where: Prisma.TreatmentWhereInput = {
                ...(patientId ? { patientId } : {}),
                ...(status ? { status } : {}),
                ...(unlinkedDentistOnly ? { dentistId: null } : dentistId ? { dentistId } : {}),
                ...(clinicId
                    ? {
                          OR: [
                              { patient: { clinicId } },
                              { planning: { patient: { clinicId } } },
                          ],
                      }
                    : {}),
                ...(search
                    ? {
                          AND: [
                              {
                                  OR: [
                                      { doctorName: { contains: search, mode: 'insensitive' } },
                                      { patient: { name: { contains: search, mode: 'insensitive' } } },
                                      { planning: { title: { contains: search, mode: 'insensitive' } } },
                                  ],
                              },
                          ],
                      }
                    : {}),
            };

            const [total, treatments] = await Promise.all([
                prisma.treatment.count({ where }),
                prisma.treatment.findMany({
                    where,
                    include: {
                        patient: { select: { id: true, name: true, clinicId: true } },
                        planning: { select: { id: true, title: true } },
                        dentist: { select: { id: true, name: true, cro: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset,
                }),
            ]);

            return ok({ total, count: treatments.length, offset, limit, treatments });
        }
    );

    addTool(
        server,
        'get_treatment',
        'Obtém detalhes de um tratamento pelo ID.',
        {
            treatmentId: z.string().uuid(),
        },
        async ({ treatmentId }) => {
            const treatment = await prisma.treatment.findUnique({
                where: { id: treatmentId },
                include: {
                    patient: { select: { id: true, name: true, clinicId: true, tenantId: true } },
                    planning: true,
                    dentist: true,
                },
            });
            if (!treatment) return err('Tratamento não encontrado');
            return ok(treatment);
        }
    );

    addTool(
        server,
        'create_treatment',
        'Cria um tratamento vinculado a paciente e/ou planejamento, preenchendo nome e CRO se dentistId for informado.',
        {
            patientId: z.string().uuid().optional(),
            planningId: z.string().uuid().optional(),
            dentistId: z.string().uuid().nullable().optional(),
            doctorName: z.string().nullable().optional(),
            status: z.enum(['EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO']).optional().default('EM_ANDAMENTO'),
            startDate: z.string().optional(),
            deadline: z.string().nullable().optional(),
            endDate: z.string().nullable().optional(),
            lastAppointment: z.string().nullable().optional(),
            nextAppointment: z.string().nullable().optional(),
            notes: z.string().nullable().optional(),
        },
        async ({
            patientId,
            planningId,
            dentistId,
            doctorName,
            status,
            startDate,
            deadline,
            endDate,
            lastAppointment,
            nextAppointment,
            notes,
        }) => {
            if (!patientId && !planningId) {
                return err('Informe patientId ou planningId');
            }

            let resolvedPatientId = patientId ?? null;
            let clinicId: string | null = null;
            let tenantId: string | null = null;

            if (planningId) {
                const planning = await prisma.planning.findUnique({
                    where: { id: planningId },
                    include: { patient: { select: { id: true, clinicId: true, tenantId: true } } },
                });
                if (!planning) return err('Planejamento não encontrado');
                const existingTreatment = await prisma.treatment.findUnique({ where: { planningId } });
                if (existingTreatment) return err('Já existe um tratamento para este planejamento');
                resolvedPatientId = planning.patientId;
                clinicId = planning.patient.clinicId;
                tenantId = planning.patient.tenantId;
            } else if (patientId) {
                const patient = await prisma.patient.findUnique({ where: { id: patientId } });
                if (!patient) return err('Paciente não encontrado');
                clinicId = patient.clinicId;
                tenantId = patient.tenantId;
            }

            let dentistData: { dentistId?: string | null; doctorName?: string | null; dentistCro?: string | null } = {
                doctorName: doctorName ?? null,
            };

            if (dentistId) {
                const dentist = await prisma.dentist.findFirst({
                    where: { id: dentistId, ...(clinicId ? { clinicId } : {}), isActive: true },
                });
                if (!dentist) return err('Dentista inválido ou inativo para a clínica do paciente');
                dentistData = {
                    dentistId: dentist.id,
                    doctorName: dentist.name,
                    dentistCro: dentist.cro,
                };
            }

            const treatment = await prisma.treatment.create({
                data: {
                    planningId: planningId ?? null,
                    patientId: resolvedPatientId,
                    status,
                    startDate: parseOptionalDate(startDate, 'startDate') ?? new Date(),
                    deadline: parseOptionalDate(deadline, 'deadline') ?? null,
                    endDate: parseOptionalDate(endDate, 'endDate') ?? null,
                    lastAppointment: parseOptionalDate(lastAppointment, 'lastAppointment') ?? null,
                    nextAppointment: parseOptionalDate(nextAppointment, 'nextAppointment') ?? null,
                    notes: notes ?? null,
                    ...dentistData,
                },
            });

            await recordMcpAudit({
                tenantId,
                clinicId,
                action: 'CREATE',
                resource: 'TREATMENT',
                resourceId: treatment.id,
                details: { status: treatment.status, dentistId: treatment.dentistId },
            });

            return ok(treatment);
        }
    );

    addTool(
        server,
        'update_treatment',
        'Atualiza um tratamento (status, datas, notas, doctorName ou dentistId com sincronização automática de nome/CRO).',
        {
            treatmentId: z.string().uuid(),
            dentistId: z.string().uuid().nullable().optional(),
            doctorName: z.string().nullable().optional(),
            status: z.enum(['EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO']).optional(),
            startDate: z.string().optional(),
            deadline: z.string().nullable().optional(),
            endDate: z.string().nullable().optional(),
            lastAppointment: z.string().nullable().optional(),
            nextAppointment: z.string().nullable().optional(),
            notes: z.string().nullable().optional(),
        },
        async ({
            treatmentId,
            dentistId,
            doctorName,
            status,
            startDate,
            deadline,
            endDate,
            lastAppointment,
            nextAppointment,
            notes,
        }) => {
            const existing = await prisma.treatment.findUnique({
                where: { id: treatmentId },
                include: {
                    patient: { select: { clinicId: true, tenantId: true } },
                    planning: { select: { patient: { select: { clinicId: true, tenantId: true } } } },
                },
            });
            if (!existing) return err('Tratamento não encontrado');

            const clinicId = existing.patient?.clinicId ?? existing.planning?.patient.clinicId ?? null;
            const tenantId = existing.patient?.tenantId ?? existing.planning?.patient.tenantId ?? null;

            let dentistData: { dentistId?: string | null; doctorName?: string | null; dentistCro?: string | null } = {};
            if (dentistId === null) {
                dentistData = { dentistId: null, dentistCro: null };
            } else if (typeof dentistId === 'string') {
                const dentist = await prisma.dentist.findFirst({
                    where: { id: dentistId, ...(clinicId ? { clinicId } : {}) },
                });
                if (!dentist) return err('Dentista não pertence à clínica deste tratamento');
                dentistData = {
                    dentistId: dentist.id,
                    doctorName: dentist.name,
                    dentistCro: dentist.cro,
                };
            }

            const updated = await prisma.treatment.update({
                where: { id: treatmentId },
                data: {
                    ...(status !== undefined ? { status } : {}),
                    ...(notes !== undefined ? { notes } : {}),
                    ...(doctorName !== undefined && dentistId === undefined ? { doctorName } : {}),
                    ...(startDate !== undefined ? { startDate: parseOptionalDate(startDate, 'startDate') ?? undefined } : {}),
                    ...(deadline !== undefined ? { deadline: parseOptionalDate(deadline, 'deadline') } : {}),
                    ...(endDate !== undefined ? { endDate: parseOptionalDate(endDate, 'endDate') } : {}),
                    ...(lastAppointment !== undefined ? { lastAppointment: parseOptionalDate(lastAppointment, 'lastAppointment') } : {}),
                    ...(nextAppointment !== undefined ? { nextAppointment: parseOptionalDate(nextAppointment, 'nextAppointment') } : {}),
                    ...dentistData,
                },
            });

            await recordMcpAudit({
                tenantId,
                clinicId,
                action: 'UPDATE',
                resource: 'TREATMENT',
                resourceId: updated.id,
                details: { status: updated.status, dentistId: updated.dentistId },
            });

            return ok(updated);
        }
    );

    addTool(
        server,
        'delete_treatment',
        'Exclui um tratamento (exige confirm: true).',
        {
            treatmentId: z.string().uuid(),
            confirm: z.boolean(),
        },
        async ({ treatmentId, confirm }) => {
            if (!confirm) return err('Operação exige confirm: true');

            const existing = await prisma.treatment.findUnique({
                where: { id: treatmentId },
                include: { patient: { select: { clinicId: true, tenantId: true } } },
            });
            if (!existing) return err('Tratamento não encontrado');

            await prisma.treatment.delete({ where: { id: treatmentId } });

            await recordMcpAudit({
                tenantId: existing.patient?.tenantId ?? null,
                clinicId: existing.patient?.clinicId ?? null,
                action: 'DELETE',
                resource: 'TREATMENT',
                resourceId: existing.id,
            });

            return ok({ deleted: true, treatmentId });
        }
    );
};
