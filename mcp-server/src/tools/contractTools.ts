import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, recordMcpAudit } from '../lib/prisma';
import { addTool, err, ok } from '../lib/toolHelpers';

export const registerContractTools = (server: McpServer) => {
    addTool(
        server,
        'list_contracts',
        'Lista contratos/termos do Planner com filtros por clínica, paciente, planejamento, status de assinatura ou trecho de texto.',
        {
            clinicId: z.string().uuid().optional(),
            patientId: z.string().uuid().optional(),
            planningId: z.string().uuid().optional(),
            isSigned: z.boolean().optional(),
            search: z.string().optional().describe('Busca no nome do paciente ou conteúdo do contrato'),
            limit: z.number().int().min(1).max(200).optional().default(50),
            offset: z.number().int().min(0).optional().default(0),
        },
        async ({ clinicId, patientId, planningId, isSigned, search, limit, offset }) => {
            const where: Prisma.ContractWhereInput = {
                ...(patientId ? { patientId } : {}),
                ...(planningId ? { planningId } : {}),
                ...(isSigned !== undefined ? { isSigned } : {}),
                ...(clinicId ? { patient: { clinicId } } : {}),
                ...(search
                    ? {
                          OR: [
                              { content: { contains: search, mode: 'insensitive' } },
                              { patient: { name: { contains: search, mode: 'insensitive' } } },
                          ],
                      }
                    : {}),
            };

            const [total, contracts] = await Promise.all([
                prisma.contract.count({ where }),
                prisma.contract.findMany({
                    where,
                    select: {
                        id: true,
                        patientId: true,
                        planningId: true,
                        isSigned: true,
                        signedAt: true,
                        createdAt: true,
                        updatedAt: true,
                        patient: { select: { id: true, name: true, clinicId: true } },
                        planning: { select: { id: true, title: true, dentistId: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset,
                }),
            ]);

            return ok({ total, count: contracts.length, offset, limit, contracts });
        }
    );

    addTool(
        server,
        'get_contract',
        'Obtém o conteúdo completo de um contrato pelo ID.',
        {
            contractId: z.string().uuid(),
        },
        async ({ contractId }) => {
            const contract = await prisma.contract.findUnique({
                where: { id: contractId },
                include: {
                    patient: { select: { id: true, name: true, clinicId: true, tenantId: true } },
                    planning: { select: { id: true, title: true, dentistId: true } },
                },
            });
            if (!contract) return err('Contrato não encontrado');
            return ok(contract);
        }
    );

    addTool(
        server,
        'create_contract',
        'Cria um novo contrato/termo para um paciente.',
        {
            patientId: z.string().uuid(),
            content: z.string().min(1),
            planningId: z.string().uuid().nullable().optional(),
            logoUrl: z.string().nullable().optional(),
        },
        async ({ patientId, content, planningId, logoUrl }) => {
            const patient = await prisma.patient.findUnique({ where: { id: patientId } });
            if (!patient) return err('Paciente não encontrado');

            if (planningId) {
                const planning = await prisma.planning.findFirst({ where: { id: planningId, patientId } });
                if (!planning) return err('Planejamento não encontrado para este paciente');
            }

            const contract = await prisma.contract.create({
                data: {
                    patientId,
                    content,
                    planningId: planningId ?? null,
                    logoUrl: logoUrl ?? null,
                },
            });

            await recordMcpAudit({
                tenantId: patient.tenantId,
                clinicId: patient.clinicId,
                action: 'CREATE',
                resource: 'CONTRACT',
                resourceId: contract.id,
                details: { patientId, planningId: contract.planningId },
            });

            return ok(contract);
        }
    );

    addTool(
        server,
        'update_contract',
        'Atualiza conteúdo ou planningId de um contrato (se já assinado, exige confirmSignedOverride: true).',
        {
            contractId: z.string().uuid(),
            content: z.string().min(1).optional(),
            planningId: z.string().uuid().nullable().optional(),
            confirmSignedOverride: z.boolean().optional().default(false),
        },
        async ({ contractId, content, planningId, confirmSignedOverride }) => {
            const existing = await prisma.contract.findUnique({
                where: { id: contractId },
                include: { patient: { select: { clinicId: true, tenantId: true } } },
            });
            if (!existing) return err('Contrato não encontrado');
            if (existing.isSigned && !confirmSignedOverride) {
                return err('Contrato já está assinado. Informe confirmSignedOverride: true para alterá-lo.');
            }

            const updated = await prisma.contract.update({
                where: { id: contractId },
                data: {
                    ...(content !== undefined ? { content } : {}),
                    ...(planningId !== undefined ? { planningId } : {}),
                },
            });

            await recordMcpAudit({
                tenantId: existing.patient.tenantId,
                clinicId: existing.patient.clinicId,
                action: 'UPDATE',
                resource: 'CONTRACT',
                resourceId: updated.id,
                details: { wasSigned: existing.isSigned },
            });

            return ok(updated);
        }
    );

    addTool(
        server,
        'sign_contract',
        'Marca um contrato como assinado.',
        {
            contractId: z.string().uuid(),
        },
        async ({ contractId }) => {
            const existing = await prisma.contract.findUnique({
                where: { id: contractId },
                include: { patient: { select: { clinicId: true, tenantId: true } } },
            });
            if (!existing) return err('Contrato não encontrado');

            const updated = await prisma.contract.update({
                where: { id: contractId },
                data: { isSigned: true, signedAt: existing.signedAt ?? new Date() },
            });

            await recordMcpAudit({
                tenantId: existing.patient.tenantId,
                clinicId: existing.patient.clinicId,
                action: 'UPDATE',
                resource: 'CONTRACT',
                resourceId: updated.id,
                details: { operation: 'SIGN' },
            });

            return ok(updated);
        }
    );

    addTool(
        server,
        'delete_contract',
        'Exclui um contrato (exige confirm: true).',
        {
            contractId: z.string().uuid(),
            confirm: z.boolean(),
        },
        async ({ contractId, confirm }) => {
            if (!confirm) return err('Operação exige confirm: true');

            const existing = await prisma.contract.findUnique({
                where: { id: contractId },
                include: { patient: { select: { clinicId: true, tenantId: true } } },
            });
            if (!existing) return err('Contrato não encontrado');

            await prisma.contract.delete({ where: { id: contractId } });

            await recordMcpAudit({
                tenantId: existing.patient.tenantId,
                clinicId: existing.patient.clinicId,
                action: 'DELETE',
                resource: 'CONTRACT',
                resourceId: existing.id,
            });

            return ok({ deleted: true, contractId });
        }
    );
};
