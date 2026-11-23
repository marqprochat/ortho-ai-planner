import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../lib/prisma';
import { isSyncRunning, runLoggedSync } from '../services/syncRunLogger';

// Ultimas execucoes da sincronizacao com o EasyDental (super admin)
export const listSyncRuns = async (req: AuthRequest, res: Response) => {
    try {
        const limit = Math.min(90, Math.max(1, parseInt(String(req.query.limit), 10) || 30));
        const runs = await prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: limit });
        res.json({ runs, running: isSyncRunning(), schedule: '05:00 (America/Sao_Paulo)' });
    } catch (error: any) {
        console.error('Error listing sync runs:', error);
        res.status(500).json({ error: 'Erro ao carregar execuções da sincronização' });
    }
};

// Dispara uma sincronizacao agora, em segundo plano
export const triggerSyncRun = async (_req: AuthRequest, res: Response) => {
    if (isSyncRunning()) return res.status(409).json({ error: 'Já existe uma sincronização em andamento' });
    void runLoggedSync('manual');
    res.status(202).json({ started: true });
};
