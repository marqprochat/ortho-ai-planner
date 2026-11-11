import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { parseDentistInput } from '../../../backend/src/lib/dentist';
import {
    analyzeContractDentistText,
    DentistTarget,
    extractReportDentistInfo,
    matchDentistCandidate,
    replaceReportDentistInfo,
} from '../../../backend/src/lib/dentistMatcher';
import { prisma, recordMcpAudit } from '../lib/prisma';
import { addTool, err, ok } from '../lib/toolHelpers';

interface PreviewItem {
    id: string;
    type: 'treatment' | 'planning' | 'contract';
    patientId: string | null;
    patientName: string;
    label: string;
    currentName: string | null;
    currentCro: string | null;
    currentDentistId: string | null;
    score: number;
    reason: string;
    isSigned?: boolean;
    snippet?: string;
}

const buildDentistPreview = async (dentistId: string, clinicId?: string) => {
    const dentist = await prisma.dentist.findFirst({
        where: { id: dentistId, ...(clinicId ? { clinicId } : {}) },
        include: { clinic: { select: { id: true, name: true, tenantId: true } } },
    });
    if (!dentist) return null;

    const target: DentistTarget = { id: dentist.id, name: dentist.name, cro: dentist.cro };
    const scopedClinicId = dentist.clinicId;

    const [treatments, plannings, contracts] = await Promise.all([
        prisma.treatment.findMany({
            where: {
                OR: [
                    { patient: { clinicId: scopedClinicId } },
                    { planning: { patient: { clinicId: scopedClinicId } } },
                ],
            },
            select: {
                id: true,
                patientId: true,
                dentistId: true,
                doctorName: true,
                dentistCro: true,
                status: true,
                patient: { select: { name: true } },
                planning: { select: { title: true, patient: { select: { id: true, name: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.planning.findMany({
            where: { patient: { clinicId: scopedClinicId } },
            select: {
                id: true,
                title: true,
                patientId: true,
                dentistId: true,
                structuredPlan: true,
                originalReport: true,
                patient: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.contract.findMany({
            where: { patient: { clinicId: scopedClinicId } },
            select: {
                id: true,
                patientId: true,
                content: true,
                isSigned: true,
                patient: { select: { name: true } },
                planning: { select: { title: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    const items: PreviewItem[] = [];

    for (const t of treatments) {
        if (t.dentistId === target.id && t.doctorName === target.name && t.dentistCro === target.cro) continue;
        const match =
            t.dentistId === target.id
                ? { matched: true, score: 1, reason: 'Vínculo atual com nome/CRO divergente' }
                : matchDentistCandidate(t.doctorName, t.dentistCro, target);
        if (!match.matched) continue;

        items.push({
            id: t.id,
            type: 'treatment',
            patientId: t.patientId ?? t.planning?.patient?.id ?? null,
            patientName: t.patient?.name || t.planning?.patient?.name || 'Paciente',
            label: t.planning?.title ? `Tratamento (${t.planning.title})` : `Tratamento (${t.status})`,
            currentName: t.doctorName,
            currentCro: t.dentistCro,
            currentDentistId: t.dentistId,
            score: match.score,
            reason: match.reason,
        });
    }

    for (const p of plannings) {
        const sp =
            p.structuredPlan && typeof p.structuredPlan === 'object' && !Array.isArray(p.structuredPlan)
                ? (p.structuredPlan as Record<string, unknown>)
                : null;
        const spName = typeof sp?.nomeOrtodontista === 'string' ? sp.nomeOrtodontista : null;
        const spCro = typeof sp?.croOrtodontista === 'string' ? sp.croOrtodontista : null;
        const spDentistId = typeof sp?.dentistId === 'string' ? sp.dentistId : null;
        const reportInfo = extractReportDentistInfo(p.originalReport);

        const candName = spName || reportInfo.name;
        const candCro = spCro || reportInfo.cro;

        const isSpSynced = !sp || (spDentistId === target.id && spName === target.name && spCro === target.cro);
        const isReportSynced =
            (!reportInfo.name || reportInfo.name === target.name) &&
            (!reportInfo.cro || reportInfo.cro === target.cro);

        if (p.dentistId === target.id && isSpSynced && isReportSynced) continue;

        const match =
            p.dentistId === target.id
                ? { matched: true, score: 1, reason: 'Vínculo atual com dados divergentes' }
                : matchDentistCandidate(candName, candCro, target);
        if (!match.matched) continue;

        items.push({
            id: p.id,
            type: 'planning',
            patientId: p.patientId,
            patientName: p.patient.name,
            label: `Planejamento: ${p.title}`,
            currentName: candName,
            currentCro: candCro,
            currentDentistId: p.dentistId,
            score: match.score,
            reason: match.reason,
        });
    }

    for (const c of contracts) {
        const contractMatch = analyzeContractDentistText(c.content, target);
        if (!contractMatch) continue;

        items.push({
            id: c.id,
            type: 'contract',
            patientId: c.patientId,
            patientName: c.patient.name,
            label: c.planning?.title ? `Contrato (${c.planning.title})` : 'Contrato / Termo',
            currentName: contractMatch.currentName,
            currentCro: contractMatch.currentCro,
            currentDentistId: null,
            score: contractMatch.score,
            reason: contractMatch.reason,
            isSigned: c.isSigned,
            snippet: contractMatch.snippet,
        });
    }

    items.sort((a, b) => b.score - a.score || a.patientName.localeCompare(b.patientName));

    return {
        dentist: {
            id: dentist.id,
            clinicId: dentist.clinicId,
            clinicName: dentist.clinic.name,
            tenantId: dentist.clinic.tenantId,
            name: dentist.name,
            cro: dentist.cro,
            isActive: dentist.isActive,
        },
        summary: {
            total: items.length,
            treatments: items.filter((i) => i.type === 'treatment').length,
            plannings: items.filter((i) => i.type === 'planning').length,
            contracts: items.filter((i) => i.type === 'contract').length,
        },
        items,
    };
};

export const registerDentistTools = (server: McpServer) => {
    addTool(
        server,
        'list_dentists',
        'Lista dentistas cadastrados, opcionalmente filtrados por clínica, status ativo ou busca.',
        {
            clinicId: z.string().uuid().optional().describe('ID da clínica'),
            includeInactive: z.boolean().optional().default(false),
            search: z.string().optional().describe('Filtro por nome ou CRO'),
        },
        async ({ clinicId, includeInactive, search }) => {
            const dentists = await prisma.dentist.findMany({
                where: {
                    ...(clinicId ? { clinicId } : {}),
                    ...(!includeInactive ? { isActive: true } : {}),
                    ...(search
                        ? {
                              OR: [
                                  { name: { contains: search, mode: 'insensitive' } },
                                  { cro: { contains: search, mode: 'insensitive' } },
                              ],
                          }
                        : {}),
                },
                include: {
                    clinic: { select: { id: true, name: true } },
                    _count: { select: { plannings: true, treatments: true } },
                },
                orderBy: [{ clinicId: 'asc' }, { name: 'asc' }],
            });
            return ok({ count: dentists.length, dentists });
        }
    );

    addTool(
        server,
        'create_dentist',
        'Cadastra um novo dentista em uma clínica.',
        {
            clinicId: z.string().uuid(),
            name: z.string().min(1),
            cro: z.string().min(1),
            easyDentalId: z.string().nullable().optional(),
        },
        async ({ clinicId, name, cro, easyDentalId }) => {
            const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
            if (!clinic) return err('Clínica não encontrada');

            const parsed = parseDentistInput({ name, cro, easyDentalId });
            if (!parsed.ok) return err(parsed.error);

            const dentist = await prisma.dentist.create({
                data: { ...parsed.data, clinicId },
            });

            await recordMcpAudit({
                tenantId: clinic.tenantId,
                clinicId,
                action: 'CREATE',
                resource: 'CLINIC',
                resourceId: dentist.id,
                details: { entity: 'DENTIST', name: dentist.name, cro: dentist.cro },
            });

            return ok(dentist);
        }
    );

    addTool(
        server,
        'update_dentist',
        'Atualiza nome, CRO, easyDentalId ou status ativo de um dentista.',
        {
            dentistId: z.string().uuid(),
            name: z.string().min(1).optional(),
            cro: z.string().min(1).optional(),
            easyDentalId: z.string().nullable().optional(),
            isActive: z.boolean().optional(),
        },
        async ({ dentistId, name, cro, easyDentalId, isActive }) => {
            const existing = await prisma.dentist.findUnique({
                where: { id: dentistId },
                include: { clinic: { select: { tenantId: true } } },
            });
            if (!existing) return err('Dentista não encontrado');

            const parsed = parseDentistInput({
                name: name ?? existing.name,
                cro: cro ?? existing.cro,
                easyDentalId: easyDentalId !== undefined ? easyDentalId : existing.easyDentalId,
            });
            if (!parsed.ok) return err(parsed.error);

            const updated = await prisma.dentist.update({
                where: { id: dentistId },
                data: {
                    ...parsed.data,
                    ...(isActive !== undefined ? { isActive } : {}),
                },
            });

            await recordMcpAudit({
                tenantId: existing.clinic.tenantId,
                clinicId: existing.clinicId,
                action: 'UPDATE',
                resource: 'CLINIC',
                resourceId: updated.id,
                details: { entity: 'DENTIST', name: updated.name, cro: updated.cro, isActive: updated.isActive },
            });

            return ok(updated);
        }
    );

    addTool(
        server,
        'delete_dentist',
        'Remove um dentista (ou desativa caso já possua planejamentos/tratamentos vinculados).',
        {
            dentistId: z.string().uuid(),
            confirm: z.boolean().describe('Confirmação obrigatória (true)'),
        },
        async ({ dentistId, confirm }) => {
            if (!confirm) return err('Operação exige confirm: true');

            const existing = await prisma.dentist.findUnique({
                where: { id: dentistId },
                include: {
                    clinic: { select: { tenantId: true } },
                    _count: { select: { plannings: true, treatments: true } },
                },
            });
            if (!existing) return err('Dentista não encontrado');

            if (existing._count.plannings + existing._count.treatments > 0) {
                await prisma.dentist.update({ where: { id: dentistId }, data: { isActive: false } });
                await recordMcpAudit({
                    tenantId: existing.clinic.tenantId,
                    clinicId: existing.clinicId,
                    action: 'UPDATE',
                    resource: 'CLINIC',
                    resourceId: dentistId,
                    details: { entity: 'DENTIST', deactivated: true },
                });
                return ok({ deactivated: true, dentistId });
            }

            await prisma.dentist.delete({ where: { id: dentistId } });
            await recordMcpAudit({
                tenantId: existing.clinic.tenantId,
                clinicId: existing.clinicId,
                action: 'DELETE',
                resource: 'CLINIC',
                resourceId: dentistId,
                details: { entity: 'DENTIST', deleted: true },
            });
            return ok({ deleted: true, dentistId });
        }
    );

    addTool(
        server,
        'list_unlinked_dentist_names',
        'Lista nomes e CROs legados em tratamentos e planejamentos sem dentista vinculado (ou divergentes) em uma clínica, sugerindo dentistas cadastrados compatíveis.',
        {
            clinicId: z.string().uuid().describe('ID da clínica'),
        },
        async ({ clinicId }) => {
            const dentists = await prisma.dentist.findMany({
                where: { clinicId },
                select: { id: true, name: true, cro: true, isActive: true },
            });

            const [treatments, plannings] = await Promise.all([
                prisma.treatment.findMany({
                    where: {
                        dentistId: null,
                        doctorName: { not: null },
                        OR: [{ patient: { clinicId } }, { planning: { patient: { clinicId } } }],
                    },
                    select: { id: true, doctorName: true, dentistCro: true },
                }),
                prisma.planning.findMany({
                    where: { dentistId: null, patient: { clinicId } },
                    select: { id: true, structuredPlan: true, originalReport: true },
                }),
            ]);

            const buckets = new Map<
                string,
                {
                    rawName: string;
                    rawCro: string | null;
                    treatmentsCount: number;
                    planningsCount: number;
                    suggestions: Array<{ dentistId: string; name: string; cro: string; score: number; reason: string }>;
                }
            >();

            const addOccurrence = (rawName: string | null, rawCro: string | null, source: 'treatment' | 'planning') => {
                const trimmed = rawName?.trim();
                if (!trimmed) return;
                const key = `${trimmed.toLowerCase()}::${(rawCro || '').trim().toUpperCase()}`;
                let bucket = buckets.get(key);
                if (!bucket) {
                    const suggestions = dentists
                        .map((d) => {
                            const m = matchDentistCandidate(trimmed, rawCro, d);
                            return m.matched ? { dentistId: d.id, name: d.name, cro: d.cro, score: m.score, reason: m.reason } : null;
                        })
                        .filter((x): x is NonNullable<typeof x> => x !== null)
                        .sort((a, b) => b.score - a.score);

                    bucket = {
                        rawName: trimmed,
                        rawCro: rawCro?.trim() || null,
                        treatmentsCount: 0,
                        planningsCount: 0,
                        suggestions,
                    };
                    buckets.set(key, bucket);
                }
                if (source === 'treatment') bucket.treatmentsCount++;
                else bucket.planningsCount++;
            };

            for (const t of treatments) addOccurrence(t.doctorName, t.dentistCro, 'treatment');
            for (const p of plannings) {
                const sp =
                    p.structuredPlan && typeof p.structuredPlan === 'object' && !Array.isArray(p.structuredPlan)
                        ? (p.structuredPlan as Record<string, unknown>)
                        : null;
                const reportInfo = extractReportDentistInfo(p.originalReport);
                const name = (typeof sp?.nomeOrtodontista === 'string' ? sp.nomeOrtodontista : null) || reportInfo.name;
                const cro = (typeof sp?.croOrtodontista === 'string' ? sp.croOrtodontista : null) || reportInfo.cro;
                addOccurrence(name, cro, 'planning');
            }

            const entries = Array.from(buckets.values()).sort(
                (a, b) => b.treatmentsCount + b.planningsCount - (a.treatmentsCount + a.planningsCount)
            );

            return ok({ clinicId, distinctLegacyNames: entries.length, entries });
        }
    );

    addTool(
        server,
        'preview_dentist_standardization',
        'Simula (dry-run) a padronização de um dentista cadastrado em tratamentos, planejamentos e contratos da mesma clínica.',
        {
            dentistId: z.string().uuid().describe('ID do dentista cadastrado que servirá como padrão'),
            clinicId: z.string().uuid().optional().describe('ID da clínica (opcional; validado se informado)'),
        },
        async ({ dentistId, clinicId }) => {
            const preview = await buildDentistPreview(dentistId, clinicId);
            if (!preview) return err('Dentista não encontrado para esta clínica');
            return ok(preview);
        }
    );

    addTool(
        server,
        'apply_dentist_standardization',
        'Aplica o dentista padrão em registros específicos (ou em todos os encontrados no preview, se applyAllFound=true e confirm=true).',
        {
            dentistId: z.string().uuid(),
            clinicId: z.string().uuid().optional(),
            treatmentIds: z.array(z.string().uuid()).optional().default([]),
            planningIds: z.array(z.string().uuid()).optional().default([]),
            contractIds: z.array(z.string().uuid()).optional().default([]),
            applyAllFound: z.boolean().optional().default(false).describe('Se true, aplica em todos os itens retornados pelo preview (exceto contratos assinados, salvo includeSignedContracts=true)'),
            includeSignedContracts: z.boolean().optional().default(false),
            confirm: z.boolean().describe('Confirmação obrigatória (true) para gravar alterações no banco'),
        },
        async ({
            dentistId,
            clinicId,
            treatmentIds,
            planningIds,
            contractIds,
            applyAllFound,
            includeSignedContracts,
            confirm,
        }) => {
            if (!confirm) {
                return err('Operação de escrita exige confirm: true. Use preview_dentist_standardization antes.');
            }

            const preview = await buildDentistPreview(dentistId, clinicId);
            if (!preview) return err('Dentista não encontrado para esta clínica');

            const target: DentistTarget = {
                id: preview.dentist.id,
                name: preview.dentist.name,
                cro: preview.dentist.cro,
            };
            const scopedClinicId = preview.dentist.clinicId;

            const finalTreatmentIds = applyAllFound
                ? preview.items.filter((i) => i.type === 'treatment').map((i) => i.id)
                : Array.from(new Set(treatmentIds));
            const finalPlanningIds = applyAllFound
                ? preview.items.filter((i) => i.type === 'planning').map((i) => i.id)
                : Array.from(new Set(planningIds));
            const finalContractIds = applyAllFound
                ? preview.items
                      .filter((i) => i.type === 'contract' && (includeSignedContracts || !i.isSigned))
                      .map((i) => i.id)
                : Array.from(new Set(contractIds));

            const updated = await prisma.$transaction(async (tx) => {
                let treatmentCount = 0;
                let planningCount = 0;
                let contractCount = 0;

                if (finalTreatmentIds.length > 0) {
                    const res = await tx.treatment.updateMany({
                        where: {
                            id: { in: finalTreatmentIds },
                            OR: [
                                { patient: { clinicId: scopedClinicId } },
                                { planning: { patient: { clinicId: scopedClinicId } } },
                            ],
                        },
                        data: {
                            dentistId: target.id,
                            doctorName: target.name,
                            dentistCro: target.cro,
                        },
                    });
                    treatmentCount = res.count;
                }

                if (finalPlanningIds.length > 0) {
                    const plannings = await tx.planning.findMany({
                        where: { id: { in: finalPlanningIds }, patient: { clinicId: scopedClinicId } },
                        select: { id: true, structuredPlan: true, originalReport: true },
                    });

                    for (const p of plannings) {
                        const data: Prisma.PlanningUpdateInput = {
                            dentist: { connect: { id: target.id } },
                        };

                        if (p.structuredPlan && typeof p.structuredPlan === 'object' && !Array.isArray(p.structuredPlan)) {
                            data.structuredPlan = {
                                ...(p.structuredPlan as Record<string, unknown>),
                                dentistId: target.id,
                                nomeOrtodontista: target.name,
                                croOrtodontista: target.cro,
                            } as Prisma.InputJsonValue;
                        }

                        if (p.originalReport) {
                            const replaced = replaceReportDentistInfo(p.originalReport, target);
                            if (replaced !== p.originalReport) {
                                data.originalReport = replaced;
                            }
                        }

                        await tx.planning.update({ where: { id: p.id }, data });
                        planningCount++;
                    }
                }

                if (finalContractIds.length > 0) {
                    const contracts = await tx.contract.findMany({
                        where: { id: { in: finalContractIds }, patient: { clinicId: scopedClinicId } },
                        select: { id: true, content: true },
                    });

                    for (const c of contracts) {
                        const match = analyzeContractDentistText(c.content, target);
                        if (!match) continue;
                        await tx.contract.update({
                            where: { id: c.id },
                            data: { content: match.updatedContent },
                        });
                        contractCount++;
                    }
                }

                return {
                    treatments: treatmentCount,
                    plannings: planningCount,
                    contracts: contractCount,
                    total: treatmentCount + planningCount + contractCount,
                };
            });

            await recordMcpAudit({
                tenantId: preview.dentist.tenantId,
                clinicId: scopedClinicId,
                action: 'UPDATE',
                resource: 'CLINIC',
                resourceId: target.id,
                details: {
                    operation: 'MCP_STANDARDIZE_DENTIST',
                    dentistName: target.name,
                    dentistCro: target.cro,
                    updated,
                },
            });

            return ok({ dentist: target, updated });
        }
    );
};
