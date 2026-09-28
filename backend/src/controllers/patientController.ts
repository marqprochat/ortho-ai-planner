import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, hasPermission } from '../middleware/authMiddleware';
import { formatCPF, cleanDigits, findPacienteByCPF, createEasyDentalPatient, findPrestadorByCPF, getPacienteByCod } from '../lib/easydental';

// Resolve ID do prestador do dentista logado ou usa o padrão
async function resolvePrestadorId(userId: string): Promise<string> {
    const defaultPrestador = process.env.EASYDENTAL_DEFAULT_PRESTADOR || '6274';
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, cpf: true, easyDentalPrestadorId: true }
        });
        if (user?.easyDentalPrestadorId) {
            return user.easyDentalPrestadorId;
        }
        if (user?.cpf) {
            const prestador = await findPrestadorByCPF(user.cpf);
            if (prestador?.ID_PRESTADOR) {
                const prestadorId = String(prestador.ID_PRESTADOR);
                await prisma.user.update({
                    where: { id: userId },
                    data: { easyDentalPrestadorId: prestadorId }
                });
                return prestadorId;
            }
        }
    } catch (e: any) {
        console.error('Erro ao resolver prestadorId do dentista:', e.message);
    }
    return defaultPrestador;
}

// Get all patients for the logged-in dentist, filtered by selected clinic
export const getPatients = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, tenantId, clinicId } = req;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        const patients = await prisma.patient.findMany({
            where: {
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId }) // Filter by dentist if not admin
            },
            include: {
                _count: {
                    select: { plannings: true, contracts: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(patients);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar pacientes' });
    }
};

// Create a new patient (com unificação EasyDental)
export const createPatient = async (req: AuthRequest, res: Response) => {
    try {
        const { 
            name, 
            cpf, 
            email, 
            phone, 
            birthDate, 
            externalId, 
            patientNumber, 
            easyDentalId, 
            paymentType, 
            insuranceCompany 
        } = req.body;
        const { userId, tenantId, clinicId } = req;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nome do paciente é obrigatório' });
        }

        if (!cpf || !cpf.trim()) {
            return res.status(400).json({ error: 'CPF é obrigatório para cadastrar o paciente' });
        }

        const formattedCpf = formatCPF(cpf);
        const cleanCpf = cleanDigits(cpf);

        // Verifica duplicidade no Planner nesta clínica
        const existingInPlanner = await prisma.patient.findFirst({
            where: {
                tenantId: tenantId!,
                clinicId: clinicId,
                OR: [
                    { cpf: formattedCpf },
                    { cpf: cleanCpf },
                    ...(patientNumber ? [{ patientNumber: String(patientNumber) }] : [])
                ]
            }
        });

        if (existingInPlanner) {
            return res.status(400).json({ 
                error: 'Já existe um paciente cadastrado com este CPF/Código nesta clínica',
                patientId: existingInPlanner.id 
            });
        }

        let finalPatientNumber = patientNumber ? String(patientNumber) : (externalId ? String(externalId) : null);
        let finalEasyDentalId = easyDentalId ? String(easyDentalId) : null;
        let syncStatus = 'SINCRONIZADO';
        let syncWarning: string | null = null;

        // Se NÃO foi passado o easyDentalId (não veio de uma busca prévia com paciente já existente no EasyDental)
        if (!finalEasyDentalId) {
            try {
                // 1. Antes de criar, verifica se o paciente já existe no EasyDental pelo CPF ou Código
                let easyMatch = await findPacienteByCPF(formattedCpf);
                if (!easyMatch && finalPatientNumber) {
                    const detailsByCod = await getPacienteByCod(finalPatientNumber);
                    if (detailsByCod?.CPF) {
                        easyMatch = await findPacienteByCPF(detailsByCod.CPF);
                    }
                }

                if (easyMatch && (easyMatch.ID_PACIENTE || easyMatch.CODIGO_PACIENTE)) {
                    finalEasyDentalId = String(easyMatch.ID_PACIENTE || '');
                    finalPatientNumber = String(easyMatch.CODIGO_PACIENTE || finalPatientNumber || '');
                    syncStatus = 'SINCRONIZADO';
                } else {
                    // 2. Não existe no EasyDental: cria em ambos os sistemas
                    const prestadorId = await resolvePrestadorId(userId!);
                    const createdEasy = await createEasyDentalPatient({
                        name: name.trim(),
                        cpf: formattedCpf,
                        birthDate,
                        phone,
                        prestadorId
                    });
                    finalEasyDentalId = createdEasy.id_paciente;
                    if (createdEasy.codigo_paciente) {
                        finalPatientNumber = createdEasy.codigo_paciente;
                    }
                    syncStatus = 'SINCRONIZADO';
                }
            } catch (easyErr: any) {
                console.error('Aviso ao sincronizar paciente com EasyDental (Opção B - Fallback ativado):', easyErr.message);
                syncStatus = 'PENDENTE';
                syncWarning = 'Paciente salvo no Planner, mas a sincronização com o EasyDental está pendente devido à instabilidade do serviço.';
            }
        }

        const patient = await prisma.patient.create({
            data: {
                name: name.trim(),
                cpf: formattedCpf,
                email,
                phone,
                externalId: finalPatientNumber || externalId,
                patientNumber: finalPatientNumber,
                easyDentalId: finalEasyDentalId,
                easyDentalSyncStatus: syncStatus,
                paymentType,
                insuranceCompany,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId: tenantId!,
                userId: userId!,
                clinicId: clinicId
            }
        });

        res.status(201).json({ ...patient, warning: syncWarning });
    } catch (error: any) {
        console.error('Erro ao criar paciente:', error);
        res.status(500).json({ error: error.message || 'Erro ao criar paciente' });
    }
};

// Find existing patient or create new one (prevents duplicates)
export const findOrCreatePatient = async (req: AuthRequest, res: Response) => {
    try {
        const { 
            name, 
            cpf, 
            email, 
            phone, 
            birthDate, 
            externalId, 
            patientNumber, 
            easyDentalId, 
            paymentType, 
            insuranceCompany 
        } = req.body;
        const { userId, tenantId, clinicId } = req;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nome do paciente é obrigatório' });
        }

        const canManageAll = hasPermission(req.user, 'manage', 'patient');
        const formattedCpf = cpf ? formatCPF(cpf) : null;
        const cleanCpf = cpf ? cleanDigits(cpf) : null;

        // Critérios de busca para paciente existente no Planner
        const orConditions: any[] = [];
        if (formattedCpf) {
            orConditions.push({ cpf: formattedCpf });
            orConditions.push({ cpf: cleanCpf });
        }
        if (patientNumber) {
            orConditions.push({ patientNumber: String(patientNumber) });
            orConditions.push({ externalId: String(patientNumber) });
        }
        if (orConditions.length === 0) {
            orConditions.push({ name: name.trim() });
        }

        const existing = await prisma.patient.findFirst({
            where: {
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId }),
                OR: orConditions
            }
        });

        if (existing) {
            return res.json({ patient: existing, isNew: false });
        }

        // Se paciente não existe, cria com sincronização EasyDental
        let finalPatientNumber = patientNumber ? String(patientNumber) : (externalId ? String(externalId) : null);
        let finalEasyDentalId = easyDentalId ? String(easyDentalId) : null;
        let syncStatus = 'SINCRONIZADO';
        let syncWarning: string | null = null;

        if (formattedCpf && !finalEasyDentalId) {
            try {
                let easyMatch = await findPacienteByCPF(formattedCpf);
                if (!easyMatch && finalPatientNumber) {
                    const detailsByCod = await getPacienteByCod(finalPatientNumber);
                    if (detailsByCod?.CPF) {
                        easyMatch = await findPacienteByCPF(detailsByCod.CPF);
                    }
                }

                if (easyMatch && (easyMatch.ID_PACIENTE || easyMatch.CODIGO_PACIENTE)) {
                    finalEasyDentalId = String(easyMatch.ID_PACIENTE || '');
                    finalPatientNumber = String(easyMatch.CODIGO_PACIENTE || finalPatientNumber || '');
                } else {
                    const prestadorId = await resolvePrestadorId(userId!);
                    const createdEasy = await createEasyDentalPatient({
                        name: name.trim(),
                        cpf: formattedCpf,
                        birthDate,
                        phone,
                        prestadorId
                    });
                    finalEasyDentalId = createdEasy.id_paciente;
                    if (createdEasy.codigo_paciente) {
                        finalPatientNumber = createdEasy.codigo_paciente;
                    }
                }
            } catch (easyErr: any) {
                console.error('Aviso ao sincronizar paciente com EasyDental no findOrCreate:', easyErr.message);
                syncStatus = 'PENDENTE';
                syncWarning = 'Paciente salvo no Planner, mas a sincronização com o EasyDental está pendente.';
            }
        }

        const patient = await prisma.patient.create({
            data: {
                name: name.trim(),
                cpf: formattedCpf,
                email,
                phone,
                externalId: finalPatientNumber || externalId,
                patientNumber: finalPatientNumber,
                easyDentalId: finalEasyDentalId,
                easyDentalSyncStatus: syncStatus,
                paymentType,
                insuranceCompany,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId: tenantId!,
                userId: userId!,
                clinicId: clinicId
            }
        });

        res.status(201).json({ patient, isNew: true, warning: syncWarning });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Erro ao buscar/criar paciente' });
    }
};


// Get a single patient
export const getPatient = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { userId, tenantId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        const patient = await prisma.patient.findFirst({
            where: {
                id,
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId }) // Ensure dentist can only see own unless admin
            },
            include: {
                plannings: {
                    include: {
                        contracts: true,
                        treatment: true
                    },
                    orderBy: { createdAt: 'desc' }
                },
                contracts: {
                    orderBy: { createdAt: 'desc' }
                },
                treatments: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar paciente' });
    }
};

// Update a patient
export const updatePatient = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, cpf, email, phone, birthDate, patientNumber, easyDentalId, easyDentalSyncStatus, paymentType, insuranceCompany } = req.body;
        const { userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        // Verify ownership and clinic context
        const existing = await prisma.patient.findFirst({
            where: {
                id,
                clinicId,
                ...(canManageAll ? {} : { userId })
            }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const formattedCpf = cpf !== undefined ? (cpf ? formatCPF(cpf) : null) : existing.cpf;

        const patient = await prisma.patient.update({
            where: { id },
            data: {
                name,
                cpf: formattedCpf,
                email,
                phone,
                patientNumber: patientNumber !== undefined ? patientNumber : existing.patientNumber,
                easyDentalId: easyDentalId !== undefined ? easyDentalId : existing.easyDentalId,
                easyDentalSyncStatus: easyDentalSyncStatus !== undefined ? easyDentalSyncStatus : existing.easyDentalSyncStatus,
                paymentType,
                insuranceCompany,
                birthDate: birthDate !== undefined ? (birthDate ? new Date(birthDate) : null) : existing.birthDate,
            }
        });

        res.json(patient);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar paciente' });
    }
};

// Delete a patient
export const deletePatient = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        // Verify ownership and clinic context before delete
        const existing = await prisma.patient.findFirst({
            where: {
                id,
                clinicId,
                ...(canManageAll ? {} : { userId })
            }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        await prisma.patient.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao excluir paciente' });
    }
};

// Transfer a patient to another user
export const transferPatient = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { targetEmail } = req.body;
        const { user } = req;

        if (!user) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id }
        });

        if (!dbUser?.canTransferPatient && !user.isSuperAdmin) {
            return res.status(403).json({ error: 'Você não tem permissão para transferir pacientes' });
        }

        if (!targetEmail) {
            return res.status(400).json({ error: 'Email do destinatário é obrigatório' });
        }

        const targetUser = await prisma.user.findUnique({
            where: { email: targetEmail },
            include: {
                userClinics: {
                    take: 1,
                    include: { clinic: true }
                }
            }
        });

        if (!targetUser) {
            return res.status(404).json({ error: 'Usuário destinatário não encontrado' });
        }

        if (targetUser.userClinics.length === 0) {
            return res.status(400).json({ error: 'O usuário destinatário não está vinculado a nenhuma clínica' });
        }

        const patient = await prisma.patient.findUnique({
            where: { id }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const canManageAll = hasPermission(req.user, 'manage', 'patient');
        if (!canManageAll && patient.userId !== dbUser!.id) {
            return res.status(403).json({ error: 'Você só pode transferir seus próprios pacientes' });
        }

        const targetClinicId = targetUser.userClinics[0].clinicId;
        const targetTenantId = targetUser.tenantId;

        await prisma.patient.update({
            where: { id },
            data: {
                userId: targetUser.id,
                clinicId: targetClinicId,
                tenantId: targetTenantId
            }
        });

        res.json({ message: 'Paciente transferido com sucesso', targetUser: targetUser.name });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao transferir paciente' });
    }
};
