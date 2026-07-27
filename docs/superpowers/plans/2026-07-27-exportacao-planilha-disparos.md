# Exportação de Relatórios em Planilha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "Exportar Planilha" na aba Relatórios do app de disparos que gera um `.xlsx` com uma aba por unidade mais uma aba `Resumo`, respeitando os filtros já aplicados na tela.

**Architecture:** Toda a geração acontece no frontend — os dados já estão carregados em `DisparoReports.tsx` via `GET /api/scheduled-disparos/reports`. A agregação por unidade, hoje inline no componente, é extraída para um módulo puro consumido tanto pela tela quanto pelo exportador, para que os dois nunca divirjam. O exportador é uma função pura que monta o workbook, separada do disparo do download.

**Tech Stack:** React 18 + TypeScript + Vite, `xlsx` (SheetJS), `sonner` para toasts, `lucide-react` para ícones.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-07-27-exportacao-planilha-disparos-design.md`.
- **Nenhuma alteração no backend.** Os dados vêm completos do endpoint existente.
- Todo texto visível ao usuário em **português do Brasil**.
- Indentação de 4 espaços — padrão de todos os arquivos de `apps/disparos/src`.
- Imports de tipo usam `import type { ... }`, seguindo o padrão do app.
- **O app `disparos` não possui infraestrutura de testes** (sem vitest/jest — ver `apps/disparos/package.json`). Instalar um runner está fora do escopo aprovado. Por isso as tarefas usam, no lugar do ciclo TDD, um ciclo de verificação equivalente: `npx tsc --noEmit` → `npm run build` → checagem manual no navegador com resultado esperado explícito. Cada tarefa termina com um deliverable verificável de forma independente.
- Comandos são executados a partir de `apps/disparos` salvo indicação contrária.
- Commit ao final de cada tarefa.

---

### Task 1: Módulo de formatação de datas

Extrai as funções de formatação hoje privadas em `DisparoReports.tsx` e corrige a formatação de datas puras. `dtInicio`/`dtTermino` são `String` no Prisma (`backend/prisma/schema.prisma`, model `ScheduledDisparoLog`), no formato `YYYY-MM-DD`. `new Date('2026-07-01')` é parseado como UTC, então `.toLocaleDateString('pt-BR')` devolve `30/06/2026` no fuso America/Sao_Paulo — um dia a menos. A tela mostra isso hoje em "Intervalo de Datas Usado"; a planilha herdaria o mesmo erro.

**Files:**
- Create: `apps/disparos/src/utils/format.ts`
- Modify: `apps/disparos/src/components/DisparoReports.tsx:54-62` (remover funções locais), `:586` (trocar `formatDate` por `formatDateOnly`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `formatDateTime(iso: string): string` — `27/07/2026 08:00`
  - `formatDate(iso: string): string` — para timestamps ISO completos
  - `formatDateOnly(ymd: string): string` — para strings `YYYY-MM-DD`, sem conversão de fuso

- [ ] **Step 1: Criar `apps/disparos/src/utils/format.ts`**

```ts
export function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
}

/**
 * Formata uma data pura ("YYYY-MM-DD") sem passar por Date, evitando o
 * deslocamento de um dia causado pelo parse em UTC.
 */
export function formatDateOnly(ymd: string) {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('T')[0].split('-');
    if (!y || !m || !d) return ymd;
    return `${d}/${m}/${y}`;
}
```

- [ ] **Step 2: Remover as funções locais de `DisparoReports.tsx`**

Apagar o bloco das linhas 54-62:

```ts
function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
}
```

E adicionar, logo abaixo do import de `../types` (linha 9):

```ts
import { formatDateTime, formatDateOnly } from '../utils/format';
```

- [ ] **Step 3: Corrigir a exibição do intervalo na tela**

Na linha 586, trocar:

```tsx
                                                        {formatDate(log.dtInicio)} → {formatDate(log.dtTermino)}
```

por:

```tsx
                                                        {formatDateOnly(log.dtInicio)} → {formatDateOnly(log.dtTermino)}
```

Depois dessa troca `formatDate` não é mais usado no componente — por isso ele não é importado no Step 2.

- [ ] **Step 4: Verificar tipos e build**

```bash
cd apps/disparos && npx tsc --noEmit
```
Esperado: nenhuma saída (sucesso). Se aparecer `'formatDate' is declared but its value is never read`, o Step 3 não foi aplicado.

```bash
npm run build
```
Esperado: `✓ built in ...`, sem erros.

- [ ] **Step 5: Verificar na tela**

```bash
npm run dev
```
Abrir a aba **Relatórios**, expandir qualquer execução e conferir "Intervalo de Datas Usado".
Esperado: a data exibida bate com o campo `dtInicio` gravado no banco (ex.: `2026-07-01` → `01/07/2026`, **não** `30/06/2026`). Data/Hora da execução continua igual a antes.

- [ ] **Step 6: Commit**

```bash
git add apps/disparos/src/utils/format.ts apps/disparos/src/components/DisparoReports.tsx
git commit -m "fix(disparos): corrige data do intervalo usado e extrai utils de formatacao"
```

---

### Task 2: Módulo de agregação por unidade

Extrai a lógica de agregação hoje inline em `DisparoReports.tsx` para um módulo puro, e adiciona `logsForUnit`, que o exportador precisa para montar as abas por unidade. Comportamento da tela deve ficar **idêntico**.

**Files:**
- Create: `apps/disparos/src/utils/reportAggregations.ts`
- Modify: `apps/disparos/src/components/DisparoReports.tsx:16-42` (mover tipos), `:64-68` (mover `successRate`), `:150-160` (mover `isLogRelatedToUnit`), `:219-252` (usar `aggregateByUnit`)

**Interfaces:**
- Consumes: nada da Task 1.
- Produces:
  - `interface UnitBreakdown { unidade: string; totalSent: number; totalErrors: number; totalProcessed: number }`
  - `interface ReportLog { ... }` — ver código abaixo
  - `interface UnitStat { unidade: string; totalSent: number; totalErrors: number; totalProcessed: number; executions: number }`
  - `interface UnitLogRow { log: ReportLog; totalSent: number; totalErrors: number; totalProcessed: number; isFallback: boolean }`
  - `successRate(sent: number, errors: number): number | null`
  - `isLogRelatedToUnit(log: ReportLog, unit: string): boolean`
  - `aggregateByUnit(logs: ReportLog[], unidadeOptions: string[]): UnitStat[]`
  - `logsForUnit(logs: ReportLog[], unidade: string): UnitLogRow[]`

- [ ] **Step 1: Criar `apps/disparos/src/utils/reportAggregations.ts`**

```ts
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
```

- [ ] **Step 2: Remover os tipos e funções duplicados de `DisparoReports.tsx`**

Apagar o bloco das linhas 16-42 (`interface UnitBreakdown` e `interface ReportLog`), o bloco das linhas 64-68 (`function successRate`) e o bloco das linhas 150-160 (`function isLogRelatedToUnit`).

Adicionar, junto aos imports do topo:

```ts
import { aggregateByUnit, isLogRelatedToUnit, successRate, type ReportLog } from '../utils/reportAggregations';
```

`UnitBreakdown` não é mais referenciado diretamente pelo componente — não precisa ser importado.

- [ ] **Step 3: Trocar o cálculo inline de `unitStats`**

Substituir todo o `useMemo` das linhas 219-252 por:

```ts
    const unitStats = useMemo(() => {
        return aggregateByUnit(filteredLogs, unidadeOptions)
            .filter(({ unidade }) => selectedUnidades.length === 0 || selectedUnidades.includes(unidade));
    }, [filteredLogs, selectedUnidades, unidadeOptions]);
```

O restante do componente (`totals`, `displayLogs`, JSX) não muda — `unitStats` mantém o mesmo formato e a mesma ordenação.

- [ ] **Step 4: Verificar tipos e build**

```bash
cd apps/disparos && npx tsc --noEmit
```
Esperado: nenhuma saída.

```bash
npm run build
```
Esperado: `✓ built in ...`, sem erros.

- [ ] **Step 5: Verificar que a tela não mudou**

```bash
npm run dev
```
Na aba **Relatórios**, com o período padrão (início do mês até hoje):
- Os cards "Por Unidade" mostram as mesmas unidades, nos mesmos valores e na mesma ordem de antes da refatoração.
- Clicar em um card ainda filtra a tabela e os cards de totais no topo.
- Marcar 1 unidade no filtro ainda reduz os cards a essa unidade.

Esperado: comportamento idêntico ao anterior. Qualquer diferença é regressão da refatoração — corrigir antes de commitar.

- [ ] **Step 6: Commit**

```bash
git add apps/disparos/src/utils/reportAggregations.ts apps/disparos/src/components/DisparoReports.tsx
git commit -m "refactor(disparos): extrai agregacao por unidade dos relatorios para utils"
```

---

### Task 3: Gerador do workbook

Instala o SheetJS e cria o módulo que monta o arquivo. Nada de UI ainda.

**Files:**
- Create: `apps/disparos/src/utils/exportReportsXlsx.ts`
- Modify: `apps/disparos/package.json` (dependência `xlsx`)

**Interfaces:**
- Consumes: `aggregateByUnit`, `logsForUnit`, `successRate`, `type ReportLog` de `./reportAggregations` (Task 2); `formatDateTime`, `formatDateOnly` de `./format` (Task 1).
- Produces:
  - `interface ExportReportsParams { logs: ReportLog[]; unidades: string[]; unidadeOptions: string[]; resolveMessageName: (modelo: string) => string; dtInicio: string; dtTermino: string; filtrosDescricao: string }`
  - `sanitizeSheetName(name: string, used: Set<string>): string`
  - `buildReportWorkbook(params: ExportReportsParams): XLSX.WorkBook`
  - `exportReportsXlsx(params: ExportReportsParams): void`

- [ ] **Step 1: Instalar o SheetJS**

```bash
cd apps/disparos && npm install xlsx
```
Esperado: `added N packages`. O pacote já traz os próprios tipos TypeScript — não instalar `@types/xlsx` (está deprecado).

- [ ] **Step 2: Criar `apps/disparos/src/utils/exportReportsXlsx.ts`**

```ts
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
            s.unidade,
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
        XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(unidade, usedNames));
    });

    return wb;
}

export function exportReportsXlsx(params: ExportReportsParams): void {
    const wb = buildReportWorkbook(params);
    XLSX.writeFile(wb, `disparos_relatorio_${params.dtInicio}_a_${params.dtTermino}.xlsx`);
}
```

- [ ] **Step 3: Verificar tipos e build**

```bash
cd apps/disparos && npx tsc --noEmit
```
Esperado: nenhuma saída.

```bash
npm run build
```
Esperado: `✓ built in ...`. O bundle cresce em algumas centenas de KB — o Vite pode emitir `(!) Some chunks are larger than 500 kB`; é esperado e aceito.

- [ ] **Step 4: Commit**

```bash
git add apps/disparos/package.json apps/disparos/package-lock.json apps/disparos/src/utils/exportReportsXlsx.ts
git commit -m "feat(disparos): gerador de planilha xlsx de relatorios por unidade"
```

---

### Task 4: Botão de exportação na aba Relatórios

Liga o gerador à UI.

**Files:**
- Modify: `apps/disparos/src/components/DisparoReports.tsx` (imports, novo estado, handler, botão na barra de filtros)

**Interfaces:**
- Consumes: `exportReportsXlsx` de `../utils/exportReportsXlsx` (Task 3).
- Produces: nada — última tarefa.

- [ ] **Step 1: Adicionar os imports**

No import de `lucide-react` (linhas 4-7), acrescentar `Download` à lista de ícones.

Abaixo do import de `reportAggregations` adicionado na Task 2:

```ts
import { exportReportsXlsx } from '../utils/exportReportsXlsx';
```

- [ ] **Step 2: Adicionar o estado de exportação**

Logo abaixo de `const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());`:

```ts
    const [exporting, setExporting] = useState(false);
```

- [ ] **Step 3: Adicionar o handler**

Inserir logo antes de `const toggleRow = (id: string) => {`:

```ts
    const handleExport = () => {
        const unidadesParaExportar = selectedUnitCard
            ? [selectedUnitCard]
            : unitStats.map(u => u.unidade);

        if (displayLogs.length === 0 || unidadesParaExportar.length === 0) {
            toast.error('Nenhum dado para exportar no período');
            return;
        }

        const filtros: string[] = [];
        if (selectedUnidades.length > 0) filtros.push(`Unidades: ${selectedUnidades.join(', ')}`);
        if (selectedScheduleId) {
            const nome = scheduleOptions.find(([id]) => id === selectedScheduleId)?.[1];
            if (nome) filtros.push(`Disparo: ${nome}`);
        }
        if (selectedUnitCard) filtros.push(`Unidade selecionada: ${selectedUnitCard}`);

        setExporting(true);
        try {
            exportReportsXlsx({
                logs: displayLogs,
                unidades: unidadesParaExportar,
                unidadeOptions,
                resolveMessageName: (modelo: string) => {
                    const tpl = messageTemplates.find(t => t.code === modelo);
                    return tpl ? tpl.name : (MODEL_NAMES[modelo] || `Modelo ${modelo}`);
                },
                dtInicio,
                dtTermino,
                filtrosDescricao: filtros.length > 0 ? filtros.join(' | ') : 'nenhum',
            });
            toast.success('Planilha exportada');
        } catch (err: any) {
            toast.error('Erro ao gerar planilha: ' + err.message);
        } finally {
            setExporting(false);
        }
    };
```

- [ ] **Step 4: Adicionar o botão na barra de filtros**

Inserir imediatamente após o botão "Atualizar" (o bloco que termina na linha ~418), antes do bloco condicional de "Limpar filtros":

```tsx
                <button
                    onClick={handleExport}
                    disabled={exporting || loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 h-[38px] mt-auto"
                >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Exportar Planilha
                </button>
```

- [ ] **Step 5: Verificar tipos e build**

```bash
cd apps/disparos && npx tsc --noEmit
```
Esperado: nenhuma saída.

```bash
npm run build
```
Esperado: `✓ built in ...`.

- [ ] **Step 6: Verificação manual — os 7 casos do spec**

```bash
npm run dev
```

Na aba **Relatórios**, executar cada caso e conferir o resultado esperado:

1. **Sem filtro de unidade** — clicar em "Exportar Planilha". Esperado: baixa `disparos_relatorio_<início>_a_<fim>.xlsx`; ao abrir, há a aba `Resumo` mais uma aba para cada unidade que aparece nos cards "Por Unidade".
2. **Com 2 unidades marcadas** — marcar duas unidades no filtro e exportar. Esperado: exatamente 3 abas (`Resumo` + as 2 unidades).
3. **Nome de unidade longo ou com `/`** — exportar incluindo essa unidade. Esperado: o arquivo abre sem aviso de reparo do Excel; a aba tem nome truncado/sanitizado; a aba `Resumo` mostra o nome completo e original.
4. **Período sem dados** — escolher um período antigo sem execuções e exportar. Esperado: toast `Nenhum dado para exportar no período`, nenhum download.
5. **Execução com falha** — localizar uma execução com status Falhou. Esperado: na aba da unidade, coluna `Status` = `Falhou` e a mensagem de erro na coluna `Observação`.
6. **Execução antiga sem `unitBreakdown`** — localizar uma execução cujo detalhamento por unidade não aparece ao expandir a linha na tela. Esperado: a linha correspondente traz `Totais da execução (sem detalhamento por unidade)` na coluna `Observação`.
7. **Conferência cruzada** — comparar a aba `Resumo` com os cards da tela sob os mesmos filtros. Esperado: Enviados, Erros e Filtrados batem unidade a unidade; a linha `TOTAL` bate com os cards de totais do topo.

Se algum caso falhar, corrigir antes do commit.

- [ ] **Step 7: Commit**

```bash
git add apps/disparos/src/components/DisparoReports.tsx
git commit -m "feat(disparos): botao de exportacao de relatorios em planilha"
```

---

## Cobertura do spec

| Requisito do spec | Tarefa |
|---|---|
| Botão na barra de filtros, ao lado de Atualizar | Task 4 |
| Respeita período, unidades, disparo e card selecionado | Task 4 (`handleExport`) |
| Sem unidade marcada → aba por unidade com dados | Task 4 (`unitStats.map`) |
| Sem dados → toast, sem arquivo | Task 4, Step 3 |
| Nome do arquivo `disparos_relatorio_<ini>_a_<fim>.xlsx` | Task 3 (`exportReportsXlsx`) |
| Aba Resumo com período, filtros e tabela por unidade | Task 3 (`buildReportWorkbook`) |
| Linha TOTAL com execuções distintas | Task 3 |
| Taxa vazia quando denominador é zero | Task 3 (`ratePercent`) |
| Uma aba por unidade, 10 colunas na ordem definida | Task 3 |
| Observação com erro e marca de fallback | Task 3 |
| Números como número, datas como texto pt-BR | Task 3 + Task 1 |
| Sanitização e desduplicação de nomes de aba | Task 3 (`sanitizeSheetName`) |
| `Resumo` reservado | Task 3 (`usedNames` inicial) |
| `reportAggregations.ts` compartilhado tela/planilha | Task 2 |
| `exportReportsXlsx.ts` com função pura separada do download | Task 3 |
| Dependência `xlsx` | Task 3, Step 1 |
| Botão desabilitado com spinner durante geração | Task 4 |
| Erro na geração → toast, tela utilizável | Task 4 (`try/catch`) |
| Nenhuma alteração no backend | Nenhuma tarefa toca `backend/` |
| 7 casos de verificação manual | Task 4, Step 6 |

**Desvio do spec:** o spec previa 3 arquivos; este plano usa 4, separando `utils/format.ts` (Task 1). O motivo é o bug de fuso em datas puras (`YYYY-MM-DD` parseado como UTC): as funções de formatação precisam ser compartilhadas entre tela e planilha, e colocá-las em `reportAggregations.ts` misturaria responsabilidades.
