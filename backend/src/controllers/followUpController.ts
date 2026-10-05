import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { parseFollowUpParams } from '../lib/followUp';
import { findTreatmentsWithoutReschedule, revalidateFollowUp } from '../services/treatmentFollowUp';

// O tenant vem do usuario autenticado, nunca do body.
export const searchFollowUpTreatments = async (req: AuthRequest, res: Response) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Não autenticado' });

    const parsed = parseFollowUpParams(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    try {
        const data = await findTreatmentsWithoutReschedule({
            tenantId,
            dtInicio: parsed.data.dtInicio,
            dtTermino: parsed.data.dtTermino,
            unidades: parsed.data.unidades,
        });
        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error searching follow-up treatments:', error.message);
        res.status(500).json({ error: 'Falha ao buscar pacientes em tratamento sem reagendamento: ' + error.message });
    }
};

export const revalidateFollowUpTreatments = async (req: AuthRequest, res: Response) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Não autenticado' });

    const parsed = parseFollowUpParams(req.body, { requireCodes: true });
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    try {
        const eligible = await revalidateFollowUp({
            tenantId,
            dtInicio: parsed.data.dtInicio,
            dtTermino: parsed.data.dtTermino,
            unidades: parsed.data.unidades,
            codigos: parsed.data.codigos ?? [],
        });
        res.json({ success: true, eligible });
    } catch (error: any) {
        console.error('Error revalidating follow-up treatments:', error.message);
        res.status(500).json({ error: 'Falha ao confirmar a situação dos pacientes: ' + error.message });
    }
};
