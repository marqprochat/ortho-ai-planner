import * as XLSX from 'xlsx';
import { aggregateByUnit, logsForUnit, successRate, type ReportLog } from './reportAggregations';
import { formatDateTime, formatDateOnly } from './format';

const SHEET_NAME_MAX = 31;
// Excel proíbe : \ / ? * [ ] em nomes de aba
const INVALID_SHEET_CHARS = /[:\\/?*[\]]/g;

export interface ExportReportsParams {
    /** Execuções já filtradas pela tela. */
    logs: ReportLog[];
    /** Unidades que viram abas, na ordem desejada. */
    unidades: string[];
    unidadeOptions: string[];
    /** Resolve o código do modelo para o nome legível da mensagem. */
    resolveMessageName: (modelo: string) => string;
    /** "YYYY-MM-DD" */
    dtInicio: string;
    /** "YYYY-MM-DD" */
    dtTermino: string;
    /** Descrição dos filtros ativos, ou "nenhum". */
    filtrosDescricao: string;
}

export function sanitizeSheetName(name: string, used: Set<string>): string {
    let base = (name || '').replace(INVALID_SHEET_CHARS, ' ').replace(/\s+/g, ' ').trim();
    if (!base) base = `Unidade ${used.size}`;

    let candidate = base.slice(0, SHEET_NAME_MAX);
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
        const suffix = `~${n}`;
        candidate = base.slice(0, SHEET_NAME_MAX - suffix.length) + suffix;
        n++;
    }

    used.add(candidate.toLowerCase());
    return candidate;
}

function ratePercent(sent: number, errors: number) {
    const rate = successRate(sent, errors);
    return rate === null ? '' : `${rate}%`;
}

/**
 * `aggregateByUnit`/`logsForUnit` usam "Todas" como chave interna para
 * disparos sem unidade configurada (mesma semântica da tela). Na planilha
 * isso precisa de um rótulo que não seja confundido com um nome de unidade
 * real.
 */
function displayUnitName(unidade: string) {
    return unidade === 'Todas' ? 'Sem unidade definida' : unidade;
}

export function buildReportWorkbook(params: ExportReportsParams): XLSX.WorkBook {
    const { logs, unidades, unidadeOptions, resolveMessageName, dtInicio, dtTermino, filtrosDescricao } = params;

    const wb = XLSX.utils.book_new();
    // "Resumo" é reservado: entra na desduplicação como qualquer colisão.
    const usedNames = new Set<string>(['resumo']);

    // ---- Aba Resumo ----
    const stats = aggregateByUnit(logs, unidadeOptions).filter(s => unidades.includes(s.unidade));

    const resumoRows: (string | number)[][] = [
        [`Período: ${formatDateOnly(dtInicio)} a ${formatDateOnly(dtTermino)}`],
        [`Filtros: ${filtrosDescricao}`],
        [],
        ['Unidade', 'Execuções', 'Enviados', 'Erros', 'Filtrados', 'Taxa de Sucesso'],
    ];

    let totalSent = 0;
    let totalErrors = 0;
    let totalProcessed = 0;

    stats.forEach(s => {
        totalSent += s.totalSent;
        totalErrors += s.totalErrors;
        totalProcessed += s.totalProcessed;
        resumoRows.push([
            displayUnitName(s.unidade),
            s.executions,
            s.totalSent,
            s.totalErrors,
            s.totalProcessed,
            ratePercent(s.totalSent, s.totalErrors),
        ]);
    });

    // Execuções no TOTAL não é a soma da coluna: uma mesma execução atinge
    // várias unidades, então somar inflaria o número.
    resumoRows.push([
        'TOTAL',
        logs.length,
        totalSent,
        totalErrors,
        totalProcessed,
        ratePercent(totalSent, totalErrors),
    ]);

    const resumoSheet = XLSX.utils.aoa_to_sheet(resumoRows);
    resumoSheet['!cols'] = [{ wch: 32 }, { wch: 11 }, { wch: 11 }, { wch: 9 }, { wch: 11 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, resumoSheet, 'Resumo');

    // ---- Uma aba por unidade ----
    unidades.forEach(unidade => {
        const rows: (string | number)[][] = [
            ['Data/Hora', 'Disparo', 'Mensagem', 'Enviados', 'Erros', 'Filtrados', 'Taxa', 'Status', 'Intervalo Usado', 'Observação'],
        ];

        logsForUnit(logs, unidade).forEach(row => {
            const obs: string[] = [];
            if (row.log.errorMessage) obs.push(row.log.errorMessage);
            if (row.isFallback) obs.push('Totais da execução (sem detalhamento por unidade)');

            rows.push([
                formatDateTime(row.log.executedAt),
                row.log.schedule.name,
                resolveMessageName(row.log.schedule.modelo),
                row.totalSent,
                row.totalErrors,
                row.totalProcessed,
                ratePercent(row.totalSent, row.totalErrors),
                row.log.status === 'completed' ? 'OK' : 'Falhou',
                `${formatDateOnly(row.log.dtInicio)} → ${formatDateOnly(row.log.dtTermino)}`,
                obs.join(' | '),
            ]);
        });

        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet['!cols'] = [
            { wch: 18 }, { wch: 26 }, { wch: 22 }, { wch: 10 }, { wch: 8 },
            { wch: 10 }, { wch: 8 }, { wch: 9 }, { wch: 24 }, { wch: 50 },
        ];
        XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(displayUnitName(unidade), usedNames));
    });

    return wb;
}

export function exportReportsXlsx(params: ExportReportsParams): void {
    const wb = buildReportWorkbook(params);
    XLSX.writeFile(wb, `disparos_relatorio_${params.dtInicio}_a_${params.dtTermino}.xlsx`);
}
