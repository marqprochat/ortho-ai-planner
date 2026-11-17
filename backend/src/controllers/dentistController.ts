import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { buildAccessibleClinicWhere, normalizeCro, parseDentistInput } from '../lib/dentist';
import {
    buildRegistrationPlan,
    clinicLabel,
    findExistingInClinic,
    formatCpfDigits,
    isValidCpf,
    onlyDigits,
    summarizePlan,
} from '../lib/dentistRegistration';
import { fetchPrestadorUnits, findPrestadorByCPF, listUnidades } from '../lib/easydental';
import { getAuditMetadataFromRequest, logAudit } from '../services/auditService';
import {
    applyDentistStandardization,
    previewDentistStandardization,
} from '../services/dentistStandardization';

const DUPLICATE_CRO_ERROR = 'Já existe um dentista com este CRO nesta clínica';

// A clínica vem do header x-clinic-id; Super Admin acessa clínicas do tenant e demais usuários apenas clínicas vinculadas em UserClinic.
const resolveClinic = async (req: AuthRequest) => {
    const where = buildAccessibleClinicWhere({
        clinicId: req.clinicId,
        userId: req.userId,
        tenantId: req.tenantId,
        isSuperAdmin: Boolean(req.user?.isSuperAdmin),
    });
    if (!where) return null;
    return prisma.clinic.findFirst({ where });
};

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === 'P2002';

export const listDentists = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const includeInactive = req.query.includeInactive === 'true';
        const dentists = await prisma.dentist.findMany({
            where: { clinicId: clinic.id, ...(includeInactive ? {} : { isActive: true }) },
            orderBy: { name: 'asc' }
        });
        res.json(dentists);
    } catch (error) {
        console.error('Error listing dentists:', error);
        res.status(500).json({ error: 'Erro ao buscar dentistas' });
    }
};

export const createDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const parsed = parseDentistInput(req.body);
        if (!parsed.ok) return res.status(400).json({ error: parsed.error });

        const dentist = await prisma.dentist.create({
            data: { ...parsed.data, clinicId: clinic.id }
        });
        res.status(201).json(dentist);
    } catch (error) {
        if (isUniqueViolation(error)) return res.status(409).json({ error: DUPLICATE_CRO_ERROR });
        console.error('Error creating dentist:', error);
        res.status(500).json({ error: 'Erro ao criar dentista' });
    }
};

export const updateDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const existing = await prisma.dentist.findFirst({ where: { id, clinicId: clinic.id } });
        if (!existing) return res.status(404).json({ error: 'Dentista não encontrado' });

        const parsed = parseDentistInput(req.body);
        if (!parsed.ok) return res.status(400).json({ error: parsed.error });

        const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : existing.isActive;
        const updated = await prisma.dentist.update({
            where: { id },
            data: { ...parsed.data, isActive }
        });
        res.json(updated);
    } catch (error) {
        if (isUniqueViolation(error)) return res.status(409).json({ error: DUPLICATE_CRO_ERROR });
        console.error('Error updating dentist:', error);
        res.status(500).json({ error: 'Erro ao atualizar dentista' });
    }
};

export const deleteDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const existing = await prisma.dentist.findFirst({
            where: { id, clinicId: clinic.id },
            include: { _count: { select: { plannings: true, treatments: true } } }
        });
        if (!existing) return res.status(404).json({ error: 'Dentista não encontrado' });

        if (existing._count.plannings + existing._count.treatments > 0) {
            await prisma.dentist.update({ where: { id }, data: { isActive: false } });
            return res.json({ deactivated: true });
        }

        await prisma.dentist.delete({ where: { id } });
        res.json({ deleted: true });
    } catch (error) {
        console.error('Error deleting dentist:', error);
        res.status(500).json({ error: 'Erro ao excluir dentista' });
    }
};

export const previewStandardizeDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const preview = await previewDentistStandardization(id, clinic.id);
        if (!preview) return res.status(404).json({ error: 'Dentista não encontrado' });

        res.json(preview);
    } catch (error) {
        console.error('Error previewing dentist standardization:', error);
        res.status(500).json({ error: 'Erro ao buscar registros semelhantes ao dentista' });
    }
};

export const applyStandardizeDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const { treatmentIds, planningIds, contractIds } = req.body ?? {};
        const toStringArray = (val: unknown): string[] =>
            Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];

        const selection = {
            treatmentIds: toStringArray(treatmentIds),
            planningIds: toStringArray(planningIds),
            contractIds: toStringArray(contractIds),
        };

        const result = await applyDentistStandardization(id, clinic.id, selection);
        if (!result) return res.status(404).json({ error: 'Dentista não encontrado' });

        logAudit({
            ...getAuditMetadataFromRequest(req),
            clinicId: clinic.id,
            action: 'UPDATE',
            resource: 'CLINIC',
            resourceId: id,
            details: {
                operation: 'STANDARDIZE_DENTIST',
                dentistName: result.dentist.name,
                dentistCro: result.dentist.cro,
                updated: result.updated,
            },
        });

        res.json(result);
    } catch (error) {
        console.error('Error applying dentist standardization:', error);
        res.status(500).json({ error: 'Erro ao padronizar registros do dentista' });
    }
};

// ---------------------------------------------------------------------------
// Cadastro a partir do CPF do prestador no EasyDental
// ---------------------------------------------------------------------------

class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');

// Carrega prestador, clínicas do tenant, clínicas acessíveis ao usuário e dentistas já cadastrados.
const loadRegistrationContext = async (req: AuthRequest, rawCpf: unknown) => {
    if (!isValidCpf(rawCpf)) throw new HttpError(400, 'CPF inválido');
    if (!req.tenantId || !req.userId) throw new HttpError(401, 'Não autenticado');
    const cpf = formatCpfDigits(rawCpf);

    const prestador = await findPrestadorByCPF(cpf);
    if (!prestador?.NOME) {
        throw new HttpError(404, 'Nenhum prestador foi encontrado no EasyDental com este CPF');
    }
    const prestadorName = collapseSpaces(String(prestador.NOME));
    const easyDentalId = prestador.ID_PRESTADOR != null ? String(prestador.ID_PRESTADOR) : null;

    const clinics = await prisma.clinic.findMany({
        where: { tenantId: req.tenantId },
        select: { id: true, name: true, nickname: true, easyDentalUnitName: true },
        orderBy: { name: 'asc' },
    });

    let accessibleIds: string[];
    if (req.user?.isSuperAdmin) {
        accessibleIds = clinics.map((c) => c.id);
    } else {
        const links = await prisma.userClinic.findMany({ where: { userId: req.userId }, select: { clinicId: true } });
        const tenantIds = new Set(clinics.map((c) => c.id));
        accessibleIds = links.map((l) => l.clinicId).filter((id) => tenantIds.has(id));
    }

    const existing = await prisma.dentist.findMany({
        where: { clinicId: { in: clinics.map((c) => c.id) } },
        select: { id: true, clinicId: true, name: true, cro: true, cpf: true, easyDentalId: true, isActive: true },
    });

    return {
        cpf,
        prestadorName,
        easyDentalId,
        clinics,
        accessibleClinicIds: new Set(accessibleIds),
        existing,
    };
};

const handleError = (res: Response, error: unknown, fallback: string, log: string) => {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error(log, error);
    return res.status(500).json({ error: fallback });
};

export const listEasyDentalUnits = async (_req: AuthRequest, res: Response) => {
    try {
        const units = await listUnidades();
        res.json(units.map((u) => u.trim()).filter(Boolean));
    } catch (error) {
        console.error('Error listing EasyDental units:', error);
        res.status(502).json({ error: 'Erro ao buscar unidades no EasyDental' });
    }
};

export const lookupDentistByCpf = async (req: AuthRequest, res: Response) => {
    try {
        const ctx = await loadRegistrationContext(req, req.body?.cpf);

        let units: string[] = [];
        let unitsFailed = false;
        try {
            units = await fetchPrestadorUnits(ctx.prestadorName);
        } catch (err) {
            console.error('Error fetching prestador units:', err);
            unitsFailed = true;
        }

        const currentClinicId = req.clinicId && ctx.accessibleClinicIds.has(req.clinicId) ? req.clinicId : null;
        const rows = buildRegistrationPlan({ ...ctx, units, currentClinicId });
        const summary = summarizePlan(rows);
        const usedFallback = rows.some((r) => r.source === 'current_clinic');

        let warning: string | null = null;
        if (unitsFailed) {
            warning = 'Não foi possível consultar as unidades do prestador no EasyDental.';
        } else if (units.length === 0) {
            warning = 'O EasyDental não registra produção deste prestador nos últimos 90 dias.';
        } else if (summary.noClinic.length > 0) {
            const names = summary.noClinic.map((r) => r.unitName).join(', ');
            warning = `Unidade(s) sem clínica vinculada no Planner: ${names}. `
                + 'Vincule em Minha Clínica > Dados da Clínica > Unidade EasyDental.';
        }
        if (usedFallback) warning = `${warning ?? ''} Mostrando a clínica selecionada.`.trim();

        const matches = ctx.clinics
            .map((c) => findExistingInClinic(c.id, ctx.existing, ctx))
            .filter((d): d is NonNullable<typeof d> => Boolean(d));

        res.json({
            prestador: { id: ctx.easyDentalId, name: ctx.prestadorName, cpf: ctx.cpf },
            suggestedCro: matches[0]?.cro ?? null,
            units,
            rows,
            canRegisterAll: summary.canRegisterAll,
            warning,
        });
    } catch (error) {
        handleError(res, error, 'Erro ao buscar prestador', 'Error looking up dentist by CPF:');
    }
};

type RegisterResult = 'created' | 'already_registered' | 'cro_conflict';

export const registerDentistByCpf = async (req: AuthRequest, res: Response) => {
    try {
        const cro = normalizeCro(req.body?.cro);
        if (!cro) return res.status(400).json({ error: 'CRO é obrigatório' });

        const rawIds: unknown = req.body?.clinicIds;
        const clinicIds = Array.isArray(rawIds)
            ? [...new Set(rawIds.filter((v): v is string => typeof v === 'string' && v.trim() !== ''))]
            : [];
        if (clinicIds.length === 0) return res.status(400).json({ error: 'Selecione ao menos uma unidade' });

        const ctx = await loadRegistrationContext(req, req.body?.cpf);
        const clinicById = new Map(ctx.clinics.map((c) => [c.id, c]));

        if (clinicIds.some((id) => !clinicById.has(id))) return res.status(400).json({ error: 'Unidade inválida' });

        const denied = clinicIds.filter((id) => !ctx.accessibleClinicIds.has(id));
        if (denied.length > 0) {
            const names = denied.map((id) => clinicLabel(clinicById.get(id)!)).join(', ');
            return res.status(403).json({ error: `Você não tem permissão para adicionar dentistas em: ${names}` });
        }

        const results: { clinicId: string; clinicName: string; result: RegisterResult; dentistId?: string }[] = [];
        const updates: { id: string; data: Record<string, string> }[] = [];
        const creates: { clinicId: string; cpf: string; cro: string; name: string; easyDentalId: string | null }[] = [];

        for (const clinicId of clinicIds) {
            const clinicName = clinicLabel(clinicById.get(clinicId)!);
            const found = findExistingInClinic(clinicId, ctx.existing, ctx);
            if (found) {
                // Completa CPF/ID de cadastros antigos, feitos antes do CPF existir.
                const data: Record<string, string> = {};
                if (!onlyDigits(found.cpf)) data.cpf = ctx.cpf;
                if (!found.easyDentalId && ctx.easyDentalId) data.easyDentalId = ctx.easyDentalId;
                if (Object.keys(data).length > 0) updates.push({ id: found.id, data });
                results.push({ clinicId, clinicName, result: 'already_registered', dentistId: found.id });
                continue;
            }
            if (ctx.existing.some((d) => d.clinicId === clinicId && d.cro === cro)) {
                results.push({ clinicId, clinicName, result: 'cro_conflict' });
                continue;
            }
            creates.push({ clinicId, cpf: ctx.cpf, cro, name: ctx.prestadorName, easyDentalId: ctx.easyDentalId });
            results.push({ clinicId, clinicName, result: 'created' });
        }

        const createdRecords = await prisma.$transaction(async (tx) => {
            for (const u of updates) await tx.dentist.update({ where: { id: u.id }, data: u.data });
            const out = [];
            for (const data of creates) out.push(await tx.dentist.create({ data }));
            return out;
        });

        for (const row of results) {
            if (row.result === 'created') row.dentistId = createdRecords.find((r) => r.clinicId === row.clinicId)?.id;
        }

        if (creates.length > 0) {
            logAudit({
                ...getAuditMetadataFromRequest(req),
                clinicId: req.clinicId ?? null,
                action: 'CREATE',
                resource: 'CLINIC',
                resourceId: ctx.easyDentalId,
                details: {
                    operation: 'REGISTER_DENTIST_BY_CPF',
                    dentistName: ctx.prestadorName,
                    dentistCro: cro,
                    clinics: results,
                },
            });
        }

        res.status(creates.length > 0 ? 201 : 200).json({ prestador: { name: ctx.prestadorName }, results });
    } catch (error) {
        if (isUniqueViolation(error)) return res.status(409).json({ error: DUPLICATE_CRO_ERROR });
        handleError(res, error, 'Erro ao cadastrar dentista', 'Error registering dentist by CPF:');
    }
};
