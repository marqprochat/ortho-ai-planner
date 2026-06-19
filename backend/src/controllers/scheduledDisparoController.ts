import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { executeScheduledDisparo, reloadTask, unregisterTask } from '../jobs/disparoCron';

export const listScheduledDisparos = async (_req: Request, res: Response) => {
    try {
        const schedules = await prisma.scheduledDisparo.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                logs: {
                    orderBy: { executedAt: 'desc' },
                    take: 1,
                },
            },
        });
        res.json(schedules);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getScheduledDisparo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const schedule = await prisma.scheduledDisparo.findUnique({
            where: { id },
            include: {
                logs: { orderBy: { executedAt: 'desc' }, take: 10 },
            },
        });
        if (!schedule) return res.status(404).json({ error: 'Agendamento não encontrado' });
        res.json(schedule);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createScheduledDisparo = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const {
            name, description, cronExpression, isActive,
            unidades, agendas, statusAgendamento, periodos, motivo,
            dtInicioOffset, dtTerminoOffset, modelo, delayMs, concurrentLimit,
        } = req.body;

        if (!name || !cronExpression) {
            return res.status(400).json({ error: 'name e cronExpression são obrigatórios' });
        }

        const schedule = await prisma.scheduledDisparo.create({
            data: {
                name,
                description: description || null,
                cronExpression,
                isActive: isActive ?? true,
                unidades: unidades || [],
                agendas: agendas || [],
                statusAgendamento: statusAgendamento || [],
                periodos: periodos || [],
                motivo: motivo || '',
                dtInicioOffset: dtInicioOffset ?? 1,
                dtTerminoOffset: dtTerminoOffset ?? 1,
                modelo: modelo || '22180',
                delayMs: delayMs ?? 1000,
                concurrentLimit: concurrentLimit ?? 5,
                createdBy: user?.id || 'system',
            },
        });

        await reloadTask(schedule.id);
        res.status(201).json(schedule);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const updateScheduledDisparo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name, description, cronExpression, isActive,
            unidades, agendas, statusAgendamento, periodos, motivo,
            dtInicioOffset, dtTerminoOffset, modelo, delayMs, concurrentLimit,
        } = req.body;

        const schedule = await prisma.scheduledDisparo.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(cronExpression !== undefined && { cronExpression }),
                ...(isActive !== undefined && { isActive }),
                ...(unidades !== undefined && { unidades }),
                ...(agendas !== undefined && { agendas }),
                ...(statusAgendamento !== undefined && { statusAgendamento }),
                ...(periodos !== undefined && { periodos }),
                ...(motivo !== undefined && { motivo }),
                ...(dtInicioOffset !== undefined && { dtInicioOffset }),
                ...(dtTerminoOffset !== undefined && { dtTerminoOffset }),
                ...(modelo !== undefined && { modelo }),
                ...(delayMs !== undefined && { delayMs }),
                ...(concurrentLimit !== undefined && { concurrentLimit }),
            },
        });

        await reloadTask(id);
        res.json(schedule);
    } catch (error: any) {
        if ((error as any).code === 'P2025') return res.status(404).json({ error: 'Agendamento não encontrado' });
        res.status(500).json({ error: error.message });
    }
};

export const deleteScheduledDisparo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.scheduledDisparo.delete({ where: { id } });
        unregisterTask(id);
        res.json({ success: true });
    } catch (error: any) {
        if ((error as any).code === 'P2025') return res.status(404).json({ error: 'Agendamento não encontrado' });
        res.status(500).json({ error: error.message });
    }
};

export const triggerScheduledDisparo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const schedule = await prisma.scheduledDisparo.findUnique({ where: { id } });
        if (!schedule) return res.status(404).json({ error: 'Agendamento não encontrado' });

        res.json({ message: 'Disparo iniciado em background', scheduleId: id });

        // Execute after response is sent
        executeScheduledDisparo(schedule).catch(err =>
            console.error(`[DisparoCron] Manual trigger error for ${id}:`, err)
        );
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getScheduledDisparoLogs = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const logs = await prisma.scheduledDisparoLog.findMany({
            where: { scheduleId: id },
            orderBy: { executedAt: 'desc' },
            take: 50,
        });
        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getDisparoReports = async (req: Request, res: Response) => {
    try {
        const { dtInicio, dtTermino } = req.query;

        const where: any = { status: { not: 'running' } };

        if (dtInicio || dtTermino) {
            where.executedAt = {};
            if (dtInicio) where.executedAt.gte = new Date(`${dtInicio}T00:00:00`);
            if (dtTermino) where.executedAt.lte = new Date(`${dtTermino}T23:59:59`);
        }

        const logs = await prisma.scheduledDisparoLog.findMany({
            where,
            orderBy: { executedAt: 'desc' },
            include: {
                schedule: {
                    select: { id: true, name: true, modelo: true, unidades: true },
                },
            },
            take: 500,
        });

        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
