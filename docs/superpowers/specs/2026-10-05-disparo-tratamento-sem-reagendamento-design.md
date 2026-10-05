# Disparo "Em tratamento sem reagendamento" — Design

Data: 2026-10-05

## Objetivo

No Disparador (Dental Connect), listar e enviar mensagem aos pacientes que estão em tratamento no Planner e ainda não reagendaram a próxima consulta, confirmando ao vivo a situação de cada um antes do envio. Funciona na aba Manual e nos Disparos Agendados (cron).

## Decisões do usuário

- Critério: tratamento `EM_ANDAMENTO`, sem consulta futura agendada no EasyDental, e com a última consulta há mais de N dias (N definido pelo usuário, padrão sugerido 30).
- Checagem: a busca consulta o EasyDental ao vivo; ao clicar em Enviar, o sistema revalida cada paciente selecionado e retira da fila quem reagendou nesse meio-tempo.
- Escopo: aba Manual e Disparos Agendados.
- Tenant/clínica: o Disparador não conhece clínicas do Planner; vale o tenant do usuário e o filtro de unidades do EasyDental que já existe.

## Abordagem

Novo valor de `searchMode`: `tratamento-sem-reagendamento` (ao lado de `agendamento`, `ultima-consulta`, `aniversario`). `searchMode` é texto livre em `MessageTemplate` e `ScheduledDisparo`, então não há mudança de schema nem migration.

A lista é a interseção de quatro fontes que já existem:

1. EasyDental ao vivo: `RPCGetUltimaConsulta` (via `fetchUltimaConsulta` em `backend/src/lib/easydental.ts`) na janela de datas informada. Cada registro traz `PACIENTE`, `CODIGO`, `ULTIMA_CONSULTA`, `CELULAR`, `CONSULTA_AGENDADA`, `UNIDADE`.
2. Filtro "sem consulta futura": `CONSULTA_AGENDADA` vazia.
3. Tratamentos `EM_ANDAMENTO` do tenant no Planner, ligados ao registro do EasyDental pelo "Número do Paciente" (`Patient.patientNumber`), usando `normalizeCode` de `backend/src/services/appointmentSync.ts`. Quem não está em tratamento, ou não tem número de paciente correspondente, fica fora.
4. Exclui quem teve QUALQUER consulta depois do fim da janela (consulta em todas as unidades de dtTermino+1 até hoje), porque ULTIMA_CONSULTA é a última dentro da janela e não a última do paciente.

Semântica medida do `RPCGetUltimaConsulta` (verificada em dados reais em 2026-10-05):

- As datas (`ULTIMA_CONSULTA`, `CONSULTA_AGENDADA`) chegam como ISO (`2026-09-11T00:00:00.000Z`); compara-se só `AAAA-MM-DD`.
- `ULTIMA_CONSULTA` NÃO é a última consulta do paciente: é a última dentro da janela `[dt_inicio, dt_termino]` consultada, e por unidade. Houve 188 pacientes em duas janelas disjuntas com `ULTIMA_CONSULTA` diferente em cada uma. Por isso a busca "−210..−30 dias" também devolve quem voltou depois do dia −30; a regra 4 tira esses pacientes (busca extra, em todas as unidades, de dtTermino+1 até hoje).
- `CONSULTA_AGENDADA` é do paciente (igual em todas as unidades) e só traz datas futuras; logo "consulta agendada em qualquer unidade exclui o paciente" vale mesmo com filtro de unidade.
- Todo `ULTIMA_CONSULTA` devolvido cai dentro da janela pedida; a checagem defensiva da janela não descarta registro legítimo.

"Há mais de N dias" não ganha campo novo: é a própria janela. Término = hoje − N; início = hoje − janela máxima (padrão 180 dias). No Manual, o modelo de mensagem preenche essas datas por padrão e o usuário ajusta na tela. No cron, valem `dtInicioOffset`/`dtTerminoOffset` do agendamento (por exemplo −180 e −30).

## Componentes

Backend (`backend/src/`):
- `lib/followUp.ts` (novo, puro, testável): funções que recebem registros do EasyDental e o conjunto de códigos em tratamento e devolvem os registros elegíveis; sem Prisma nem rede.
- `services/treatmentFollowUp.ts` (novo): `findTreatmentsWithoutReschedule({ tenantId, dtInicio, dtTermino, unidades })` busca os registros ao vivo (modo estrito) na janela e, em paralelo, os registros de todas as unidades de `dtTermino+1` até hoje (quem consultou depois da janela sai), carrega os códigos dos tratamentos `EM_ANDAMENTO` do tenant e aplica `lib/followUp.ts`; e `revalidateFollowUp(...)`, que refaz a busca e devolve os códigos que continuam elegíveis.
- `controllers/followUpController.ts` (novo): `POST /api/follow-up/treatments` e `POST /api/follow-up/treatments/revalidate`, ambos com `authMiddleware` e `requireAppAccess('disparos')`; o tenant vem do usuário autenticado, nunca do body.
- `jobs/disparoCron.ts`: novo ramo para `tratamento-sem-reagendamento`; o tenant é o do usuário em `createdBy`. Nos pontos que hoje tratam `ultima-consulta` (montagem do payload, `data_agendamento`, `data`, `inicio`), o novo modo se comporta igual.
- `index.ts`: registro das rotas.

Frontend (`apps/disparos/src/`):
- `types.ts`, `services/api.ts`: novo `searchMode` e chamadas dos dois endpoints.
- `App.tsx`: ao escolher um modelo com esse `searchMode`, a pesquisa usa o endpoint novo e mapeia os registros como no modo "Última consulta"; antes de enviar, chama a revalidação e remove da fila quem reagendou, marcando "já reagendou".
- `components/MessageTemplatesTab.tsx` e `components/ScheduledDisparos.tsx`: opção do novo modo no cadastro de modelos e no formulário de agendamento.

## Fluxo de dados

Manual: escolher modelo → Pesquisar (EasyDental ao vivo + cruzamento com o Planner) → tabela → Enviar → revalidação → envia só quem continua elegível.

Cron: dispara → resolve o tenant por `createdBy` → mesma busca ao vivo → envia pelo mesmo caminho dos demais modos (a busca no início da execução faz o papel da revalidação).

## Tratamento de erros

- Paciente sem celular: aparece como "Sem telefone", como hoje, e não é enviado.
- Falha ao consultar o EasyDental na pesquisa: aviso ao usuário e lista vazia. No cron: a execução termina como `failed` com a mensagem no log.
- Falha na revalidação: o envio é bloqueado com aviso; nunca envia sem checar.
- Cron com `createdBy` igual a `system` ou usuário inexistente: a execução falha com erro claro no log; nunca envia para ninguém por engano nem para todos os tenants.

## Segurança e privacidade

- O tenant é sempre derivado do usuário autenticado (ou de `createdBy` no cron); o body da requisição não escolhe tenant.
- Nenhum teste pode acionar envio real: o `docker-compose.yml` traz uma URL de webhook do BotConversa por padrão. No ambiente de teste, `BOTCONVERSA_WEBHOOK_URL` deve apontar para um destino fictício inalcançável (por exemplo `http://127.0.0.1:9/disabled`). Vazia não serve: o compose usa `${VAR:-padrão}`, que volta ao webhook real quando a variável está vazia. Os testes só leem do EasyDental.
- O Disparador não grava nada no Planner.

## Fora do escopo

- Gravar dados no Planner a partir do Disparador; sincronizar tratamentos como efeito da busca.
- Filtrar por clínica do Planner (o filtro de unidades do EasyDental já cobre).
- Mudanças de schema.
- Limitação conhecida: a tabela de disparos agendados não tem coluna de tenant, então os agendamentos só são isolados por tenant via `createdBy`.

## Testes

- Unitários (`node:test`) em `lib/followUp.ts`: registro sem consulta agendada entra; com consulta agendada sai; paciente fora do conjunto de tratamentos sai; normalização de código (`653` x `000653`); duplicados de unidades; datas vazias; checagem da janela de datas (limites inclusivos, data ausente ou ilegível excluída); exclusão de quem consultou depois da janela (`seenAfterCodes`); `addDays` e `recentWindow`. O serviço e o modo estrito não têm teste automatizado (dependem de EasyDental e Prisma): são cobertos pela verificação ao vivo abaixo.
- Verificação no host de teste (`192.168.15.7`): rotas respondem, o tenant vem do token, o modo estrito funciona com todas as unidades reais (nenhuma resposta fora do formato de lista) e quem consultou depois da janela não aparece, a revalidação tira quem reagendou, e o cron com `createdBy` inválido falha com erro claro. Sem envio real.
