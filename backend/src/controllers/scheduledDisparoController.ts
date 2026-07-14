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
            searchMode,
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
                searchMode: searchMode || 'agendamento',
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
            searchMode,
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
                ...(searchMode !== undefined && { searchMode }),
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

        const logIds = logs.map(l => l.id);

        // Agregação dos disparos automáticos por unidade e status
        const individualAggregations = await prisma.disparoIndividualLog.groupBy({
            by: ['scheduleLogId', 'unidade', 'status'],
            where: {
                scheduleLogId: { in: logIds },
            },
            _count: {
                id: true,
            },
        });

        const breakdownMap = new Map<string, Array<{
            unidade: string;
            totalSent: number;
            totalErrors: number;
            totalProcessed: number;
        }>>();

        individualAggregations.forEach(agg => {
            const logId = agg.scheduleLogId;
            if (!logId) return;

            if (!breakdownMap.has(logId)) {
                breakdownMap.set(logId, []);
            }

            const currentList = breakdownMap.get(logId)!;
            let existing = currentList.find(x => x.unidade === agg.unidade);

            if (!existing) {
                existing = {
                    unidade: agg.unidade,
                    totalSent: 0,
                    totalErrors: 0,
                    totalProcessed: 0,
                };
                currentList.push(existing);
            }

            const count = agg._count.id || 0;
            existing.totalProcessed += count;
            if (agg.status === 'sent') {
                existing.totalSent += count;
            } else if (agg.status === 'error') {
                existing.totalErrors += count;
            }
        });

        const logsWithBreakdown = logs.map(log => {
            const unitBreakdown = breakdownMap.get(log.id) || [];
            return {
                ...log,
                unitBreakdown,
            };
        });

        // Agregação dos disparos manuais por dia, unidade e status
        const manualWhere: any = { type: 'manual' };
        if (dtInicio || dtTermino) {
            manualWhere.executedAt = {};
            if (dtInicio) manualWhere.executedAt.gte = new Date(`${dtInicio}T00:00:00`);
            if (dtTermino) manualWhere.executedAt.lte = new Date(`${dtTermino}T23:59:59`);
        }

        const manualSends = await prisma.disparoIndividualLog.findMany({
            where: manualWhere,
            orderBy: { executedAt: 'desc' },
        });

        const manualGroups = new Map<string, {
            id: string;
            scheduleId: string;
            executedAt: Date;
            status: string;
            totalFetched: number;
            totalSent: number;
            totalErrors: number;
            totalProcessed: number;
            dtInicio: string;
            dtTermino: string;
            schedule: {
                id: string;
                name: string;
                modelo: string;
                unidades: string[];
            };
            unitBreakdown: Array<{
                unidade: string;
                totalSent: number;
                totalErrors: number;
                totalProcessed: number;
            }>;
        }>();

        manualSends.forEach(send => {
            const dayStr = send.executedAt.toISOString().split('T')[0];
            if (!manualGroups.has(dayStr)) {
                manualGroups.set(dayStr, {
                    id: `manual-${dayStr}`,
                    scheduleId: `manual-schedule`,
                    executedAt: send.executedAt,
                    status: 'completed',
                    totalFetched: 0,
                    totalSent: 0,
                    totalErrors: 0,
                    totalProcessed: 0,
                    dtInicio: dayStr,
                    dtTermino: dayStr,
                    schedule: {
                        id: `manual-schedule`,
                        name: 'Envios Manuais',
                        modelo: 'manual',
                        unidades: [],
                    },
                    unitBreakdown: [],
                });
            }

            const group = manualGroups.get(dayStr)!;
            group.totalProcessed++;
            if (send.status === 'sent') {
                group.totalSent++;
            } else {
                group.totalErrors++;
            }

            let ub = group.unitBreakdown.find(x => x.unidade === send.unidade);
            if (!ub) {
                ub = {
                    unidade: send.unidade,
                    totalSent: 0,
                    totalErrors: 0,
                    totalProcessed: 0,
                };
                group.unitBreakdown.push(ub);
            }

            ub.totalProcessed++;
            if (send.status === 'sent') {
                ub.totalSent++;
            } else {
                ub.totalErrors++;
            }
        });

        const manualLogs = Array.from(manualGroups.values());

        const allReports = [...logsWithBreakdown, ...manualLogs].sort(
            (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
        );

        res.json(allReports);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
