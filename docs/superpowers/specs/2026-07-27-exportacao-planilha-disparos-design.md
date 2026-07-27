# Exportação de Relatórios em Planilha — App de Disparos

**Data:** 2026-07-27
**Escopo:** aba Relatórios do app `apps/disparos`

## Problema

A aba Relatórios mostra os dados de disparos apenas na tela. Não há como levar esses números para fora do sistema — para conferência por unidade, envio a gestores ou análise em Excel. Hoje a única saída é copiar manualmente da tela.

## Objetivo

Permitir exportar o relatório de disparos como um arquivo `.xlsx`, organizado com **uma aba por unidade**, refletindo exatamente os filtros já aplicados na tela.

## Decisões

| Decisão | Escolha |
|---|---|
| Conteúdo | Dados brutos organizados por unidade (sem replicar cards/visual) |
| Organização | Uma aba por unidade selecionada + aba `Resumo` |
| Granularidade | Uma linha por execução de disparo |
| Geração | Frontend, biblioteca `xlsx` (SheetJS) |
| Seleção | Reaproveita os filtros da tela — sem modal próprio |

## Interface

Botão **"Exportar Planilha"** na barra de filtros de `DisparoReports.tsx`, ao lado de *Atualizar*, com ícone de download.

Comportamento:
- Exporta o estado atual: período (`dtInicio`/`dtTermino`), unidades selecionadas, disparo selecionado e card de unidade ativo.
- Se nenhuma unidade estiver marcada no filtro, gera uma aba para **cada unidade que tenha dados** no período.
- Se não houver dados após os filtros, exibe `toast.error('Nenhum dado para exportar no período')` e não gera arquivo.
- Nome do arquivo: `disparos_relatorio_<dtInicio>_a_<dtTermino>.xlsx` (ex.: `disparos_relatorio_2026-07-01_a_2026-07-27.xlsx`).

## Estrutura do arquivo

### Aba `Resumo` (primeira aba)

Duas linhas de contexto no topo, depois uma linha em branco, depois a tabela:

```
Período: 01/07/2026 a 27/07/2026
Filtros: Unidades: Barra, Centro | Disparo: Confirmação Diária
(linha em branco)
Unidade | Execuções | Enviados | Erros | Filtrados | Taxa de Sucesso
Barra   |    27     |   320    |  12   |    332    |      96%
Centro  |    27     |   210    |   5   |    215    |      98%
TOTAL   |    27     |   530    |  17   |    547    |      97%
```

- `Filtros:` exibe apenas os filtros ativos. Sem nenhum filtro ativo, escreve `Filtros: nenhum`.
- A linha `TOTAL` é sempre a última. Enviados, Erros e Filtrados são a soma das linhas; **Execuções não é** — é a contagem de execuções distintas no período, já que uma mesma execução costuma atingir várias unidades. Somar essa coluna daria um número inflado.
- `Taxa de Sucesso` é `enviados / (enviados + erros)`, arredondada para inteiro. Quando o denominador é zero, a célula fica vazia.
- Nesta aba o nome da unidade aparece **completo**, sem truncamento.

### Uma aba por unidade

Colunas, nesta ordem:

| Coluna | Origem |
|---|---|
| Data/Hora | `log.executedAt` formatado `dd/MM/yyyy HH:mm` (pt-BR) |
| Disparo | `log.schedule.name` |
| Mensagem | nome do template resolvido (`messageTemplates` → `MODEL_NAMES` → `Modelo <código>`) |
| Enviados | `unitBreakdown[unidade].totalSent`, ou `log.totalSent` no fallback |
| Erros | `unitBreakdown[unidade].totalErrors`, ou `log.totalErrors` no fallback |
| Filtrados | `unitBreakdown[unidade].totalProcessed`, ou `log.totalProcessed` no fallback |
| Taxa | mesma fórmula do Resumo, por linha |
| Status | `OK` ou `Falhou`, a partir de `log.status` |
| Intervalo Usado | `formatDate(log.dtInicio) → formatDate(log.dtTermino)` |
| Observação | ver abaixo |

Linhas ordenadas por data/hora decrescente, igual à tela.

**Coluna Observação** — concatena, separando por ` | `, o que se aplicar:
1. `log.errorMessage`, quando presente.
2. `Totais da execução (sem detalhamento por unidade)`, quando a execução não tem `unitBreakdown` e os números vieram dos totais do disparo inteiro.

O item 2 é obrigatório: execuções antigas sem `unitBreakdown` têm seus totais replicados em todas as unidades do disparo (mesma regra que a tela usa hoje). Sem a marca, quem somar as abas manualmente obtém números inflados sem perceber.

Valores numéricos são gravados como número, não como texto. Datas são gravadas como texto já formatado em pt-BR — previsível e independente do locale do Excel de quem abrir.

### Nomes das abas

Excel limita nomes de aba a 31 caracteres e proíbe `: \ / ? * [ ]`. Sanitização:

1. Substituir cada caractere proibido por espaço.
2. Colapsar espaços repetidos e aparar as pontas.
3. Truncar em 31 caracteres.
4. Se o resultado colidir com uma aba já criada, truncar mais e acrescentar sufixo `~2`, `~3`, … até ficar único.
5. Se o nome ficar vazio após sanitizar, usar `Unidade <n>`.

`Resumo` é reservado: uma unidade cujo nome sanitizado seja `Resumo` entra na desduplicação como qualquer outra colisão.

## Arquitetura

Três arquivos:

**`apps/disparos/src/utils/reportAggregations.ts`** (novo)
Extrai a agregação por unidade que hoje vive inline no `useMemo` de `unitStats` em `DisparoReports.tsx:219-252`. Exporta:

- `aggregateByUnit(logs, unidadeOptions)` → `Array<{ unidade, totalSent, totalErrors, totalProcessed, executions }>`
- `logsForUnit(logs, unidade)` → execuções relevantes para a unidade, cada uma com os totais já resolvidos para aquela unidade e um flag `isFallback`
- `successRate(sent, errors)` → `number | null`

Tela e planilha passam a consumir a mesma função. Sem isso, a agregação existiria em dois lugares e divergiria no primeiro ajuste.

**`apps/disparos/src/utils/exportReportsXlsx.ts`** (novo)
- `buildReportWorkbook(params)` → objeto workbook do SheetJS. Função pura, sem I/O.
- `exportReportsXlsx(params)` → chama `buildReportWorkbook` e dispara o download via `XLSX.writeFile`.

`params`: `{ logs, unidades, unidadeOptions, messageTemplates, dtInicio, dtTermino, filtrosDescricao }`.

**`apps/disparos/src/components/DisparoReports.tsx`** (alterado)
Ganha o botão e um handler curto que monta `params` e chama `exportReportsXlsx`. Passa a importar a agregação de `reportAggregations.ts` em vez de calculá-la inline. O arquivo tem 655 linhas; a mudança não o faz crescer de forma significativa.

Nenhuma alteração no backend. Os dados já vêm completos de `GET /api/scheduled-disparos/reports`.

## Dependência

`xlsx` (SheetJS) como dependência de `apps/disparos/package.json`.

**Limitação aceita:** a versão community do SheetJS não escreve estilos de célula (negrito, cor de fundo, congelar painel). A organização do arquivo vem da estrutura das abas, da ordem das colunas e das larguras de coluna (`!cols`, que é suportada). Caso formatação visual venha a ser requisito, o caminho é migrar a geração para o backend com ExcelJS — decisão adiada de propósito.

## Tratamento de erros

- Sem dados após filtros → toast de aviso, nenhum arquivo.
- Falha na geração do workbook → `toast.error('Erro ao gerar planilha: ' + msg)`; a tela permanece utilizável.
- Enquanto gera, o botão fica desabilitado com spinner. Para volumes típicos (até 500 execuções, limite do endpoint) a geração é praticamente instantânea.

## Testes

O app `disparos` não tem infraestrutura de testes hoje. Verificação manual, cobrindo:

1. Exportar sem filtro de unidade → uma aba por unidade com dados, mais `Resumo`.
2. Exportar com 2 unidades marcadas → exatamente 3 abas.
3. Unidade com nome longo ou com `/` no nome → aba com nome sanitizado e válido; nome completo preservado no `Resumo`.
4. Período sem dados → toast, sem download.
5. Execução com falha → `Status = Falhou` e `errorMessage` na coluna Observação.
6. Execução antiga sem `unitBreakdown` → marca de fallback na Observação.
7. Totais do `Resumo` batem com os cards da tela sob os mesmos filtros.

## Fora de escopo

- Detalhamento por paciente (`DisparoIndividualLog`) — exigiria novo endpoint.
- Exportação em CSV ou PDF.
- Agendamento ou envio automático da planilha por e-mail.
- Formatação visual das células.
