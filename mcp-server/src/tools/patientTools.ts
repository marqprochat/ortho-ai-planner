import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma, recordMcpAudit } from '../lib/prisma';
import { addTool, err, ok, parseOptionalDate } from '../lib/toolHelpers';

export const registerPatientTools = (server: McpServer) => {
    addTool(
        server,
        'list_patients',
        'Lista ou busca pacientes por clínica, nome, CPF, telefone, código do paciente ou tipo de pagamento.',
        {
            clinicId: z.string().uuid().optional(),
            search: z.string().optional(),
            paymentType: z.string().optional(),
            limit: z.number().int().min(1).max(200).optional().default(50),
            offset: z.number().int().min(0).optional().default(0),
        },
        async ({ clinicId, search, paymentType, limit, offset }) => {
            const where = {
                ...(clinicId ? { clinicId } : {}),
                ...(paymentType ? { paymentType } : {}),
                ...(search
                    ? {
                          OR: [
                              { name: { contains: search, mode: 'insensitive' as const } },
                              { cpf: { contains: search, mode: 'insensitive' as const } },
                              { patientNumber: { contains: search, mode: 'insensitive' as const } },
                              { email: { contains: search, mode: 'insensitive' as const } },
                              { phone: { contains: search, mode: 'insensitive' as const } },
                          ],
                      }
                    : {}),
            };

            const [total, patients] = await Promise.all([
                prisma.patient.count({ where }),
                prisma.patient.findMany({
                    where,
                    include: {
                        clinic: { select: { id: true, name: true } },
                        _count: { select: { plannings: true, treatments: true, contracts: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset,
                }),
            ]);

            return ok({ total, count: patients.length, offset, limit, patients });
        }
    );

    addTool(
        server,
        'get_patient',
        'Obtém detalhes completos de um paciente, incluindo planejamentos, tratamentos e contratos.',
        {
            patientId: z.string().uuid(),
        },
        async ({ patientId }) => {
            const patient = await prisma.patient.findUnique({
                where: { id: patientId },
                include: {
                    clinic: { select: { id: true, name: true, cro: true } },
                    user: { select: { id: true, name: true, email: true } },
                    plannings: {
                        include: { dentist: { select: { id: true, name: true, cro: true } } },
                        orderBy: { createdAt: 'desc' },
                    },
                    treatments: {
                        include: { dentist: { select: { id: true, name: true, cro: true } } },
                        orderBy: { createdAt: 'desc' },
                    },
                    contracts: { orderBy: { createdAt: 'desc' } },
                },
            });
            if (!patient) return err('Paciente não encontrado');
            return ok(patient);
        }
    );

    addTool(
        server,
        'create_patient',
        'Cria um novo paciente em uma clínica do Planner.',
        {
            clinicId: z.string().uuid(),
            name: z.string().min(1),
            userId: z.string().uuid().optional().describe('ID do usuário responsável (opcional: usa primeiro usuário da clínica/tenant se omitido)'),
            patientNumber: z.string().nullable().optional(),
            cpf: z.string().nullable().optional(),
            birthDate: z.string().nullable().optional().describe('ISO date string'),
            email: z.string().nullable().optional(),
            phone: z.string().nullable().optional(),
            paymentType: z.string().nullable().optional(),
            insuranceCompany: z.string().nullable().optional(),
            easyDentalId: z.string().nullable().optional(),
        },
        async ({ clinicId, userId, birthDate, ...rest }) => {
            const clinic = await prisma.clinic.findUnique({
                where: { id: clinicId },
                include: {
                    userClinics: { take: 1, select: { userId: true } },
                },
            });
            if (!clinic) return err('Clínica não encontrada');

            let resolvedUserId: string | undefined = userId ?? clinic.userClinics[0]?.userId;
            if (!resolvedUserId) {
                const fallbackUser = await prisma.user.findFirst({
                    where: { tenantId: clinic.tenantId },
                    select: { id: true },
                });
                resolvedUserId = fallbackUser?.id;
            }
            if (!resolvedUserId) return err('Nenhum usuário encontrado no tenant para vincular ao paciente');

            const patient = await prisma.patient.create({
                data: {
                    ...rest,
                    birthDate: parseOptionalDate(birthDate, 'birthDate') ?? null,
                    clinicId: clinic.id,
                    tenantId: clinic.tenantId,
                    userId: resolvedUserId,
                },
            });

            await recordMcpAudit({
                tenantId: clinic.tenantId,
                clinicId: clinic.id,
                action: 'CREATE',
                resource: 'PATIENT',
                resourceId: patient.id,
                details: { name: patient.name },
            });

            return ok(patient);
        }
    );

    addTool(
        server,
        'update_patient',
        'Atualiza dados cadastrais de um paciente.',
        {
            patientId: z.string().uuid(),
            name: z.string().min(1).optional(),
            patientNumber: z.string().nullable().optional(),
            cpf: z.string().nullable().optional(),
            birthDate: z.string().nullable().optional(),
            email: z.string().nullable().optional(),
            phone: z.string().nullable().optional(),
            paymentType: z.string().nullable().optional(),
            insuranceCompany: z.string().nullable().optional(),
            easyDentalId: z.string().nullable().optional(),
        },
        async ({ patientId, birthDate, ...fields }) => {
            const existing = await prisma.patient.findUnique({ where: { id: patientId } });
            if (!existing) return err('Paciente não encontrado');

            const parsedBirthDate = parseOptionalDate(birthDate, 'birthDate');
            const data = {
                ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
                ...(parsedBirthDate !== undefined ? { birthDate: parsedBirthDate } : {}),
            };
            if (Object.keys(data).length === 0) return err('Nenhum campo fornecido para atualização');

            const updated = await prisma.patient.update({
                where: { id: patientId },
                data,
            });

            await recordMcpAudit({
                tenantId: existing.tenantId,
                clinicId: existing.clinicId,
                action: 'UPDATE',
                resource: 'PATIENT',
                resourceId: updated.id,
                details: { fields: Object.keys(data) },
            });

            return ok(updated);
        }
    );

    addTool(
        server,
        'transfer_patient',
        'Transfere um paciente para outra clínica do mesmo tenant.',
        {
            patientId: z.string().uuid(),
            targetClinicId: z.string().uuid(),
        },
        async ({ patientId, targetClinicId }) => {
            const patient = await prisma.patient.findUnique({ where: { id: patientId } });
            if (!patient) return err('Paciente não encontrado');

            const targetClinic = await prisma.clinic.findFirst({
                where: { id: targetClinicId, tenantId: patient.tenantId },
            });
            if (!targetClinic) return err('Clínica de destino não encontrada no mesmo tenant');

            const updated = await prisma.patient.update({
                where: { id: patientId },
                data: { clinicId: targetClinic.id },
            });

            await recordMcpAudit({
                tenantId: patient.tenantId,
                clinicId: targetClinic.id,
                action: 'UPDATE',
                resource: 'PATIENT',
                resourceId: patient.id,
                details: { operation: 'TRANSFER', fromClinicId: patient.clinicId, toClinicId: targetClinic.id },
            });

            return ok(updated);
        }
    );

    addTool(
        server,
        'delete_patient',
        'Exclui um paciente e seus registros em cascata (exige confirm: true).',
        {
            patientId: z.string().uuid(),
            confirm: z.boolean(),
        },
        async ({ patientId, confirm }) => {
            if (!confirm) return err('Operação exige confirm: true');

            const existing = await prisma.patient.findUnique({ where: { id: patientId } });
            if (!existing) return err('Paciente não encontrado');

            await prisma.patient.delete({ where: { id: patientId } });

            await recordMcpAudit({
                tenantId: existing.tenantId,
                clinicId: existing.clinicId,
                action: 'DELETE',
                resource: 'PATIENT',
                resourceId: existing.id,
                details: { name: existing.name },
            });

            return ok({ deleted: true, patientId });
        }
    );
};
