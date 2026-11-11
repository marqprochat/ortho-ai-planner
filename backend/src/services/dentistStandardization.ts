import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import {
    analyzeContractDentistText,
    DentistTarget,
    extractReportDentistInfo,
    matchDentistCandidate,
    replaceReportDentistInfo,
} from '../lib/dentistMatcher';

export type StandardizationRecordType = 'treatment' | 'planning' | 'contract';

export interface StandardizationCandidateItem {
    id: string;
    type: StandardizationRecordType;
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

export interface StandardizationPreviewResult {
    dentist: DentistTarget & { isActive: boolean };
    items: StandardizationCandidateItem[];
    summary: {
        total: number;
        treatments: number;
        plannings: number;
        contracts: number;
    };
}

export interface StandardizationSelection {
    treatmentIds?: string[];
    planningIds?: string[];
    contractIds?: string[];
}

export interface StandardizationApplyResult {
    dentist: DentistTarget;
    updated: {
        treatments: number;
        plannings: number;
        contracts: number;
        total: number;
    };
}

/**
 * Finds treatments, plannings, and contracts in a clinic whose dentist references match `dentistId`.
 */
export const previewDentistStandardization = async (
    dentistId: string,
    clinicId: string
): Promise<StandardizationPreviewResult | null> => {
    const dentist = await prisma.dentist.findFirst({
        where: { id: dentistId, clinicId },
        select: { id: true, name: true, cro: true, isActive: true },
    });
    if (!dentist) return null;

    const target: DentistTarget = { id: dentist.id, name: dentist.name, cro: dentist.cro };

    const [treatments, plannings, contracts] = await Promise.all([
        prisma.treatment.findMany({
            where: {
                OR: [
                    { patient: { clinicId } },
                    { planning: { patient: { clinicId } } },
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
            where: { patient: { clinicId } },
            select: {
                id: true,
                title: true,
                status: true,
                patientId: true,
                dentistId: true,
                structuredPlan: true,
                originalReport: true,
                patient: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.contract.findMany({
            where: { patient: { clinicId } },
            select: {
                id: true,
                patientId: true,
                content: true,
                isSigned: true,
                createdAt: true,
                patient: { select: { name: true } },
                planning: { select: { title: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    const items: StandardizationCandidateItem[] = [];

    for (const t of treatments) {
        const isExact =
            t.dentistId === target.id &&
            t.doctorName === target.name &&
            t.dentistCro === target.cro;
        if (isExact) continue;

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

        const isSpSynced =
            !sp ||
            (spDentistId === target.id && spName === target.name && spCro === target.cro);
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
        dentist,
        items,
        summary: {
            total: items.length,
            treatments: items.filter((i) => i.type === 'treatment').length,
            plannings: items.filter((i) => i.type === 'planning').length,
            contracts: items.filter((i) => i.type === 'contract').length,
        },
    };
};

/**
 * Applies standardization to the explicitly approved record IDs scoped to `clinicId`.
 */
export const applyDentistStandardization = async (
    dentistId: string,
    clinicId: string,
    selection: StandardizationSelection
): Promise<StandardizationApplyResult | null> => {
    const dentist = await prisma.dentist.findFirst({
        where: { id: dentistId, clinicId },
        select: { id: true, name: true, cro: true },
    });
    if (!dentist) return null;

    const treatmentIds = Array.from(new Set(selection.treatmentIds ?? []));
    const planningIds = Array.from(new Set(selection.planningIds ?? []));
    const contractIds = Array.from(new Set(selection.contractIds ?? []));

    const updated = await prisma.$transaction(async (tx) => {
        let treatmentCount = 0;
        let planningCount = 0;
        let contractCount = 0;

        if (treatmentIds.length > 0) {
            const res = await tx.treatment.updateMany({
                where: {
                    id: { in: treatmentIds },
                    OR: [
                        { patient: { clinicId } },
                        { planning: { patient: { clinicId } } },
                    ],
                },
                data: {
                    dentistId: dentist.id,
                    doctorName: dentist.name,
                    dentistCro: dentist.cro,
                },
            });
            treatmentCount = res.count;
        }

        if (planningIds.length > 0) {
            const plannings = await tx.planning.findMany({
                where: { id: { in: planningIds }, patient: { clinicId } },
                select: { id: true, structuredPlan: true, originalReport: true },
            });

            for (const p of plannings) {
                const data: Prisma.PlanningUpdateInput = {
                    dentist: { connect: { id: dentist.id } },
                };

                if (p.structuredPlan && typeof p.structuredPlan === 'object' && !Array.isArray(p.structuredPlan)) {
                    data.structuredPlan = {
                        ...(p.structuredPlan as Record<string, unknown>),
                        dentistId: dentist.id,
                        nomeOrtodontista: dentist.name,
                        croOrtodontista: dentist.cro,
                    } as Prisma.InputJsonValue;
                }

                if (p.originalReport) {
                    const replaced = replaceReportDentistInfo(p.originalReport, dentist);
                    if (replaced !== p.originalReport) {
                        data.originalReport = replaced;
                    }
                }

                await tx.planning.update({ where: { id: p.id }, data });
                planningCount++;
            }
        }

        if (contractIds.length > 0) {
            const contracts = await tx.contract.findMany({
                where: { id: { in: contractIds }, patient: { clinicId } },
                select: { id: true, content: true },
            });

            for (const c of contracts) {
                const match = analyzeContractDentistText(c.content, dentist);
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

    return { dentist, updated };
};

