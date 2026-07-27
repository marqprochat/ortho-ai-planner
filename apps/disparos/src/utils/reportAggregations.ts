export interface UnitBreakdown {
    unidade: string;
    totalSent: number;
    totalErrors: number;
    totalProcessed: number;
}

export interface ReportLog {
    id: string;
    scheduleId: string;
    executedAt: string;
    status: 'completed' | 'failed';
    totalFetched: number;
    totalSent: number;
    totalErrors: number;
    totalProcessed: number;
    errorMessage?: string;
    dtInicio: string;
    dtTermino: string;
    schedule: {
        id: string;
        name: string;
        modelo: string;
        unidades: string[];
    };
    unitBreakdown?: UnitBreakdown[];
}

export interface UnitStat {
    unidade: string;
    totalSent: number;
    totalErrors: number;
    totalProcessed: number;
    executions: number;
}

/**
 * Uma execução vista sob a ótica de uma unidade. Quando a execução não tem
 * unitBreakdown (registros antigos), os totais são os do disparo inteiro e
 * isFallback fica true — quem consome precisa sinalizar isso ao usuário.
 */
export interface UnitLogRow {
    log: ReportLog;
    totalSent: number;
    totalErrors: number;
    totalProcessed: number;
    isFallback: boolean;
}

function hasActivity(ub: UnitBreakdown) {
    return ub.totalProcessed > 0 || ub.totalSent > 0 || ub.totalErrors > 0;
}

export function successRate(sent: number, errors: number) {
    const total = sent + errors;
    if (total === 0) return null;
    return Math.round((sent / total) * 100);
}

export function isLogRelatedToUnit(log: ReportLog, unit: string) {
    if (log.unitBreakdown && log.unitBreakdown.length > 0) {
        const ub = log.unitBreakdown.find(x => x.unidade === unit);
        return ub ? hasActivity(ub) : false;
    }
    const logUnidades = log.schedule.unidades;
    if (unit === 'Todas') {
        return logUnidades.length === 0;
    }
    return logUnidades.length === 0 || logUnidades.includes(unit);
}

export function aggregateByUnit(logs: ReportLog[], unidadeOptions: string[]): UnitStat[] {
    const map = new Map<string, { totalSent: number; totalErrors: number; totalProcessed: number; executions: number }>();

    logs.forEach(log => {
        if (log.unitBreakdown && log.unitBreakdown.length > 0) {
            log.unitBreakdown.forEach(ub => {
                const existing = map.get(ub.unidade) || { totalSent: 0, totalErrors: 0, totalProcessed: 0, executions: 0 };
                map.set(ub.unidade, {
                    totalSent: existing.totalSent + ub.totalSent,
                    totalErrors: existing.totalErrors + ub.totalErrors,
                    totalProcessed: existing.totalProcessed + ub.totalProcessed,
                    executions: existing.executions + (hasActivity(ub) ? 1 : 0),
                });
            });
        } else {
            const units = log.schedule.unidades.length > 0 ? log.schedule.unidades : ['Todas', ...unidadeOptions];
            units.forEach(u => {
                const existing = map.get(u) || { totalSent: 0, totalErrors: 0, totalProcessed: 0, executions: 0 };
                map.set(u, {
                    totalSent: existing.totalSent + log.totalSent,
                    totalErrors: existing.totalErrors + log.totalErrors,
                    totalProcessed: existing.totalProcessed + log.totalProcessed,
                    executions: existing.executions + 1,
                });
            });
        }
    });

    return Array.from(map.entries())
        .map(([unidade, stats]) => ({ unidade, ...stats }))
        .sort((a, b) => b.totalSent - a.totalSent);
}

export function logsForUnit(logs: ReportLog[], unidade: string): UnitLogRow[] {
    const rows: UnitLogRow[] = [];

    logs.forEach(log => {
        if (log.unitBreakdown && log.unitBreakdown.length > 0) {
            const ub = log.unitBreakdown.find(x => x.unidade === unidade);
            if (ub && hasActivity(ub)) {
                rows.push({
                    log,
                    totalSent: ub.totalSent,
                    totalErrors: ub.totalErrors,
                    totalProcessed: ub.totalProcessed,
                    isFallback: false,
                });
            }
            return;
        }

        if (isLogRelatedToUnit(log, unidade)) {
            rows.push({
                log,
                totalSent: log.totalSent,
                totalErrors: log.totalErrors,
                totalProcessed: log.totalProcessed,
                isFallback: true,
            });
        }
    });

    return rows;
}
