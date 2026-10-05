# Disparo "Em tratamento sem reagendamento" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No Disparador, listar e enviar mensagem aos pacientes em tratamento no Planner que ainda não reagendaram a próxima consulta, revalidando ao vivo no EasyDental antes de enviar; vale para a aba Manual e para os Disparos Agendados (cron).

**Architecture:** Novo `searchMode` `tratamento-sem-reagendamento` (texto livre em `MessageTemplate` e `ScheduledDisparo`, sem migration). A lista é a interseção de: registros ao vivo do `RPCGetUltimaConsulta`, só os sem `CONSULTA_AGENDADA`, e os tratamentos `EM_ANDAMENTO` do tenant ligados pelo "Número do Paciente". A lógica de seleção é pura e testada (`lib/followUp.ts`); um serviço junta EasyDental + Prisma; um controller expõe busca e revalidação; o cron ganha um ramo; o frontend do Disparador reaproveita o fluxo do modo "Última consulta".

**Tech Stack:** Node 20 + Express + Prisma 6 (backend), `node:test` via `ts-node` para testes unitários; React + Vite (apps/disparos).

**Spec:** `docs/superpowers/specs/2026-10-05-disparo-tratamento-sem-reagendamento-design.md`

## Global Constraints

- Novo valor de `searchMode`: exatamente `tratamento-sem-reagendamento`. Sem mudança de schema e sem migration.
- Critério da lista: tratamento `EM_ANDAMENTO` do tenant; ligação com o EasyDental SOMENTE pelo "Número do Paciente" (`Patient.patientNumber`) normalizado por `normalizeCode`; registro do EasyDental com `CONSULTA_AGENDADA` vazia; se o mesmo paciente tem consulta agendada em QUALQUER unidade, ele sai da lista.
- "Há mais de N dias" = a própria janela de datas da última consulta: término = hoje − N, início = término − 150 dias (padrão: −180 a −30). No Manual o modelo usa `dayOffset` como N negativo (início = `dayOffset − 150`); no cron valem `dtInicioOffset`/`dtTerminoOffset`.
- O tenant é SEMPRE derivado do usuário autenticado (`req.user.tenantId`) ou, no cron, do usuário em `createdBy`; nunca do body. `tenantId` vazio/indefinido deve lançar erro (um filtro Prisma com `undefined` removeria a restrição).
- Falha ao consultar o EasyDental NÃO pode virar lista vazia silenciosa nos fluxos novos: usar o modo estrito de `fetchUltimaConsulta`. Falha na revalidação bloqueia o envio. Cron com `createdBy` `system`/inexistente termina como `failed` com mensagem clara.
- O Disparador não grava nada no Planner.
- Mensagens ao usuário em português.
- Nenhum teste pode enviar mensagem real: no host de teste, `BOTCONVERSA_WEBHOOK_URL=http://127.0.0.1:9/disabled` (valor vazio NÃO serve, o compose volta ao webhook real). Os testes só leem do EasyDental.
- Ambiente de teste: host `edmar@192.168.15.7` via chave `~/.ssh/id_ed25519_casaos`, projeto em `~/ortho-ai-planner`, sem docker nesta máquina. Mexer só no projeto `ortho-ai-planner` (o host roda outros containers do usuário). Push só do branch `feat/disparo-tratamento-sem-reagendamento` (nunca da `main`). Nunca gravar senha em arquivo/commit.
- Este branch parte da `main`, onde o backend ainda não tem infraestrutura de teste: a Task 1 a cria com as mesmas linhas usadas no branch `feat/cadastro-dentistas` (ao mesclar os dois, o script `test` deve listar os dois arquivos de teste).

## File Structure

Backend (`backend/`):
- Create `src/lib/patientCode.ts` — `normalizeCode` (movido de `services/appointmentSync.ts`).
- Create `src/lib/followUp.ts` — constante do modo, `selectFollowUpRecords`, `parseFollowUpParams` (puros).
- Create `src/lib/followUp.test.ts` — testes `node:test`.
- Modify `src/services/appointmentSync.ts` — passa a importar/reexportar `normalizeCode`.
- Modify `src/lib/easydental.ts` — opção `strict` em `fetchUltimaConsulta`.
- Create `src/services/treatmentFollowUp.ts` — busca, revalidação, resolução de tenant.
- Create `src/controllers/followUpController.ts` — duas rotas.
- Modify `src/index.ts` — import e rotas.
- Modify `src/jobs/disparoCron.ts` — ramo do novo modo.
- Modify `package.json`, `tsconfig.json` — script de teste e exclusão de testes do build.

Frontend (`apps/disparos/src/`):
- Modify `services/api.ts`, `App.tsx`, `components/MessageTemplatesTab.tsx`, `components/ScheduledDisparos.tsx`.

---

### Task 1: Lógica pura, testes e infraestrutura de teste

**Files:**
- Create: `backend/src/lib/patientCode.ts`
- Create: `backend/src/lib/followUp.ts`
- Test: `backend/src/lib/followUp.test.ts`
- Modify: `backend/src/services/appointmentSync.ts` (linhas 1-31)
- Modify: `backend/package.json`, `backend/tsconfig.json`

**Interfaces:**
- Produces (`lib/patientCode.ts`): `export const normalizeCode: (value?: string | null) => string | null` (comportamento idêntico ao atual: só dígitos, sem zeros à esquerda, `padStart(6,'0')`).
- Produces (`lib/followUp.ts`):
  ```ts
  export const FOLLOW_UP_SEARCH_MODE = 'tratamento-sem-reagendamento';
  export const selectFollowUpRecords: (records: UltimaConsultaRecord[], treatmentCodes: ReadonlySet<string>) => UltimaConsultaRecord[];
  export interface FollowUpParams { dtInicio: string; dtTermino: string; unidades: string[]; codigos?: string[] }
  export type FollowUpParamsResult = { ok: true; data: FollowUpParams } | { ok: false; error: string };
  export const parseFollowUpParams: (body: unknown, options?: { requireCodes?: boolean }) => FollowUpParamsResult;
  ```
  `treatmentCodes` contém códigos JÁ normalizados (`normalizeCode`).

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/lib/followUp.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode } from './patientCode';
import { selectFollowUpRecords, parseFollowUpParams, FOLLOW_UP_SEARCH_MODE } from './followUp';
import type { UltimaConsultaRecord } from './easydental';

const rec = (over: Partial<UltimaConsultaRecord> = {}): UltimaConsultaRecord => ({
    PACIENTE: 'Paciente Teste',
    CODIGO: '000653',
    ULTIMA_CONSULTA: '2026-08-01',
    CELULAR: '11999990000',
    CONSULTA_AGENDADA: null,
    UNIDADE: 'Unidade A',
    ...over,
});

const codes = (...values: string[]) => new Set(values.map((v) => normalizeCode(v) as string));

test('FOLLOW_UP_SEARCH_MODE tem o valor combinado', () => {
    assert.equal(FOLLOW_UP_SEARCH_MODE, 'tratamento-sem-reagendamento');
});

test('normalizeCode iguala 653, 000653 e códigos com máscara', () => {
    assert.equal(normalizeCode('653'), '000653');
    assert.equal(normalizeCode('000653'), '000653');
    assert.equal(normalizeCode('00.653'), '000653');
    assert.equal(normalizeCode(''), null);
    assert.equal(normalizeCode(null), null);
    assert.equal(normalizeCode('abc'), null);
});

test('inclui paciente em tratamento sem consulta agendada', () => {
    const result = selectFollowUpRecords([rec()], codes('653'));
    assert.equal(result.length, 1);
    assert.equal(result[0].CODIGO, '000653');
});

test('exclui paciente com consulta agendada', () => {
    const result = selectFollowUpRecords([rec({ CONSULTA_AGENDADA: '2026-10-20' })], codes('653'));
    assert.equal(result.length, 0);
});

test('trata consulta agendada vazia ou só com espaços como sem agendamento', () => {
    const result = selectFollowUpRecords(
        [rec({ CONSULTA_AGENDADA: '' }), rec({ CODIGO: '000700', CONSULTA_AGENDADA: '   ' })],
        codes('653', '700')
    );
    assert.equal(result.length, 2);
});

test('exclui paciente que não está em tratamento no Planner', () => {
    const result = selectFollowUpRecords([rec({ CODIGO: '000999' })], codes('653'));
    assert.equal(result.length, 0);
});

test('casa código do Planner sem zeros com código do EasyDental com zeros', () => {
    const result = selectFollowUpRecords([rec({ CODIGO: '000653' })], codes('653'));
    assert.equal(result.length, 1);
});

test('se o paciente reagendou em outra unidade, sai da lista inteira', () => {
    const result = selectFollowUpRecords(
        [
            rec({ UNIDADE: 'Unidade A', CONSULTA_AGENDADA: null }),
            rec({ UNIDADE: 'Unidade B', CONSULTA_AGENDADA: '2026-10-20' }),
        ],
        codes('653')
    );
    assert.equal(result.length, 0);
});

test('mantém o mesmo paciente em duas unidades quando nenhuma tem agendamento', () => {
    const result = selectFollowUpRecords(
        [rec({ UNIDADE: 'Unidade A' }), rec({ UNIDADE: 'Unidade B' })],
        codes('653')
    );
    assert.equal(result.length, 2);
});

test('remove duplicados do mesmo paciente na mesma unidade', () => {
    const result = selectFollowUpRecords([rec(), rec()], codes('653'));
    assert.equal(result.length, 1);
});

test('ignora registros sem código', () => {
    const result = selectFollowUpRecords(
        [rec({ CODIGO: '' }), rec({ CODIGO: undefined as unknown as string })],
        codes('653')
    );
    assert.equal(result.length, 0);
});

test('conjunto de tratamentos vazio não devolve ninguém', () => {
    assert.equal(selectFollowUpRecords([rec()], new Set()).length, 0);
});

test('parseFollowUpParams aceita datas e normaliza unidades', () => {
    const result = parseFollowUpParams({
        dt_inicio: '2026-04-01',
        dt_termino: '2026-09-01',
        unidades: ['  Unidade A ', '', 'Unidade B'],
    });
    assert.deepEqual(result, {
        ok: true,
        data: { dtInicio: '2026-04-01', dtTermino: '2026-09-01', unidades: ['Unidade A', 'Unidade B'] },
    });
});

test('parseFollowUpParams aceita unidade como texto e ausente como lista vazia', () => {
    const one = parseFollowUpParams({ dt_inicio: '2026-04-01', dt_termino: '2026-09-01', unidades: 'Unidade A' });
    assert.deepEqual(one.ok && one.data.unidades, ['Unidade A']);
    const none = parseFollowUpParams({ dt_inicio: '2026-04-01', dt_termino: '2026-09-01' });
    assert.deepEqual(none.ok && none.data.unidades, []);
});

test('parseFollowUpParams rejeita datas ausentes, mal formatadas ou impossíveis', () => {
    const message = 'dt_inicio e dt_termino são obrigatórios (AAAA-MM-DD)';
    assert.deepEqual(parseFollowUpParams({}), { ok: false, error: message });
    assert.deepEqual(parseFollowUpParams({ dt_inicio: '01/04/2026', dt_termino: '2026-09-01' }), { ok: false, error: message });
    assert.deepEqual(parseFollowUpParams({ dt_inicio: '2026-02-30', dt_termino: '2026-09-01' }), { ok: false, error: message });
    assert.deepEqual(parseFollowUpParams(null), { ok: false, error: message });
});

test('parseFollowUpParams rejeita início maior que término', () => {
    assert.deepEqual(
        parseFollowUpParams({ dt_inicio: '2026-09-02', dt_termino: '2026-09-01' }),
        { ok: false, error: 'dt_inicio não pode ser maior que dt_termino' }
    );
});

test('parseFollowUpParams com requireCodes exige lista de códigos de texto', () => {
    const base = { dt_inicio: '2026-04-01', dt_termino: '2026-09-01' };
    const ok = parseFollowUpParams({ ...base, codigos: ['000653', ' 700 '] }, { requireCodes: true });
    assert.deepEqual(ok.ok && ok.data.codigos, ['000653', '700']);
    const error = 'codigos deve ser uma lista de códigos';
    assert.deepEqual(parseFollowUpParams(base, { requireCodes: true }), { ok: false, error });
    assert.deepEqual(parseFollowUpParams({ ...base, codigos: [123] }, { requireCodes: true }), { ok: false, error });
    assert.deepEqual(parseFollowUpParams({ ...base, codigos: 'x' }, { requireCodes: true }), { ok: false, error });
});

test('parseFollowUpParams limita a quantidade de códigos', () => {
    const codigos = Array.from({ length: 5001 }, (_, i) => String(i));
    const result = parseFollowUpParams({ dt_inicio: '2026-04-01', dt_termino: '2026-09-01', codigos }, { requireCodes: true });
    assert.deepEqual(result, { ok: false, error: 'codigos excede o limite de 5000' });
});
```

- [ ] **Step 2: Infraestrutura de teste e verificar que falha**

Em `backend/package.json`, trocar a linha do script `test` por:

```json
    "test": "node --require ts-node/register --test src/lib/followUp.test.ts",
```

Em `backend/tsconfig.json`, trocar o `exclude` por:

```json
    "exclude": [
        "node_modules",
        "src/**/*.test.ts"
    ]
```

Run (em `backend/`): `npm test`
Expected: FAIL com `Cannot find module './patientCode'`.

- [ ] **Step 3: Criar `patientCode.ts` e ajustar `appointmentSync.ts`**

Criar `backend/src/lib/patientCode.ts`:

```ts
// EasyDental usa codigo com 6 digitos e zeros a esquerda ("000653").
// O Planner pode ter gravado "653", "000653" ou com mascara — normalizamos os dois lados.
export const normalizeCode = (value?: string | null): string | null => {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return null;
    return digits.replace(/^0+/, '').padStart(6, '0');
};
```

Em `backend/src/services/appointmentSync.ts`: adicionar, logo após a linha `import { fetchUltimaConsulta, UltimaConsultaRecord } from '../lib/easydental';`:

```ts
import { normalizeCode } from '../lib/patientCode';
```

e substituir o bloco (comentário + definição) das linhas 24-31:

```ts
// EasyDental usa codigo com 6 digitos e zeros a esquerda ("000653").
// O Planner pode ter gravado "653", "000653" ou com mascara — normalizamos os dois lados.
export const normalizeCode = (value?: string | null): string | null => {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return null;
    return digits.replace(/^0+/, '').padStart(6, '0');
};
```

por:

```ts
// normalizeCode vive em lib/patientCode.ts; reexportado para quem ja o importa daqui.
export { normalizeCode };
```

- [ ] **Step 4: Criar `followUp.ts`**

Criar `backend/src/lib/followUp.ts`:

```ts
import { normalizeCode } from './patientCode';
import type { UltimaConsultaRecord } from './easydental';

export const FOLLOW_UP_SEARCH_MODE = 'tratamento-sem-reagendamento';

const MAX_CODES = 5000;
const DATES_ERROR = 'dt_inicio e dt_termino são obrigatórios (AAAA-MM-DD)';

const hasScheduledAppointment = (rec: UltimaConsultaRecord): boolean =>
    String(rec.CONSULTA_AGENDADA ?? '').trim() !== '';

// Pacientes em tratamento (treatmentCodes, ja normalizados) sem consulta futura.
// Se o paciente tem consulta agendada em QUALQUER unidade, ele ja reagendou e sai da lista.
export const selectFollowUpRecords = (
    records: UltimaConsultaRecord[],
    treatmentCodes: ReadonlySet<string>
): UltimaConsultaRecord[] => {
    const rescheduled = new Set<string>();
    for (const rec of records) {
        const code = normalizeCode(rec?.CODIGO);
        if (code && hasScheduledAppointment(rec)) rescheduled.add(code);
    }

    const seen = new Set<string>();
    const result: UltimaConsultaRecord[] = [];
    for (const rec of records) {
        const code = normalizeCode(rec?.CODIGO);
        if (!code || !treatmentCodes.has(code) || rescheduled.has(code)) continue;

        const key = `${code}|${rec.UNIDADE ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(rec);
    }
    return result;
};

export interface FollowUpParams {
    dtInicio: string;
    dtTermino: string;
    unidades: string[];
    codigos?: string[];
}

export type FollowUpParamsResult =
    | { ok: true; data: FollowUpParams }
    | { ok: false; error: string };

const isValidIsoDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const parseFollowUpParams = (
    body: unknown,
    options: { requireCodes?: boolean } = {}
): FollowUpParamsResult => {
    const raw = (body ?? {}) as Record<string, unknown>;
    const dtInicio = typeof raw.dt_inicio === 'string' ? raw.dt_inicio.trim() : '';
    const dtTermino = typeof raw.dt_termino === 'string' ? raw.dt_termino.trim() : '';

    if (!isValidIsoDate(dtInicio) || !isValidIsoDate(dtTermino)) return { ok: false, error: DATES_ERROR };
    if (dtInicio > dtTermino) return { ok: false, error: 'dt_inicio não pode ser maior que dt_termino' };

    let unidades: string[] = [];
    if (Array.isArray(raw.unidades)) {
        unidades = raw.unidades
            .filter((u): u is string => typeof u === 'string')
            .map((u) => u.trim())
            .filter(Boolean);
    } else if (typeof raw.unidades === 'string' && raw.unidades.trim() !== '') {
        unidades = [raw.unidades.trim()];
    }

    const data: FollowUpParams = { dtInicio, dtTermino, unidades };

    if (options.requireCodes) {
        if (!Array.isArray(raw.codigos) || !raw.codigos.every((c) => typeof c === 'string')) {
            return { ok: false, error: 'codigos deve ser uma lista de códigos' };
        }
        if (raw.codigos.length > MAX_CODES) {
            return { ok: false, error: `codigos excede o limite de ${MAX_CODES}` };
        }
        data.codigos = (raw.codigos as string[]).map((c) => c.trim());
    }

    return { ok: true, data };
};
```

- [ ] **Step 5: Rodar e ver passar**

Run (em `backend/`): `npm test`
Expected: todos os testes passam (`# pass 18`, `# fail 0`).

Run: `npx tsc --noEmit`
Expected: sem erros (confirma que `appointmentSync.ts` continua compilando com o reexport).

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/patientCode.ts backend/src/lib/followUp.ts backend/src/lib/followUp.test.ts backend/src/services/appointmentSync.ts backend/package.json backend/tsconfig.json
git commit -m "feat(disparos): logica pura de pacientes em tratamento sem reagendamento"
```

(O trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` vai numa linha própria, depois de uma linha em branco.)

---

### Task 2: Serviço, modo estrito do EasyDental, controller e rotas

**Files:**
- Modify: `backend/src/lib/easydental.ts` (função `fetchUltimaConsulta`, linhas 41-61)
- Create: `backend/src/services/treatmentFollowUp.ts`
- Create: `backend/src/controllers/followUpController.ts`
- Modify: `backend/src/index.ts` (imports ~linha 27; rotas após o bloco "EasyDental RPC Proxy Routes", ~linha 149)

**Interfaces:**
- Consumes: `selectFollowUpRecords`, `parseFollowUpParams` (Task 1); `normalizeCode`.
- Produces (`services/treatmentFollowUp.ts`):
  ```ts
  export interface FollowUpQuery { tenantId: string; dtInicio: string; dtTermino: string; unidades?: string[] }
  export const findTreatmentsWithoutReschedule: (query: FollowUpQuery) => Promise<UltimaConsultaRecord[]>;
  export const revalidateFollowUp: (query: FollowUpQuery & { codigos: string[] }) => Promise<string[]>; // subconjunto de `codigos` ainda elegivel
  export const resolveTenantByUserId: (userId: string) => Promise<string | null>;
  ```
- Produces (HTTP): `POST /api/follow-up/treatments` body `{ dt_inicio, dt_termino, unidades }` → `{ success: true, data: UltimaConsultaRecord[] }`; `POST /api/follow-up/treatments/revalidate` body `{ dt_inicio, dt_termino, unidades, codigos }` → `{ success: true, eligible: string[] }`. Erros: 400 (parâmetros), 401 (sem usuário), 500 (falha de consulta).

- [ ] **Step 1: Modo estrito em `fetchUltimaConsulta`**

Em `backend/src/lib/easydental.ts`, substituir a função `fetchUltimaConsulta` (comentário + função inteira, linhas 41-61) por:

```ts
// RPCGetUltimaConsulta em todas as unidades informadas (ou todas as ativas).
// Por padrao, a falha de uma unidade e registrada e ignorada. Com { strict: true }
// qualquer falha e propagada (usado quando uma lista vazia por erro seria enganosa).
export async function fetchUltimaConsulta(
    dt_inicio: string,
    dt_termino: string,
    unidades?: string[],
    options: { strict?: boolean } = {}
): Promise<UltimaConsultaRecord[]> {
    const targetUnits = unidades && unidades.length > 0 ? unidades : await listUnidades();
    if (targetUnits.length === 0) return [];

    const results = await Promise.all(
        targetUnits.map((nm_unidade) =>
            rpcCall('RPCGetUltimaConsulta', { dt_inicio, dt_termino, nm_unidade })
                .then((data) => (Array.isArray(data) ? data : data ? [data] : []))
                .catch((err) => {
                    if (options.strict) throw err;
                    console.error(`Error fetching ultima consulta for unit ${nm_unidade}:`, err.message);
                    return [];
                })
        )
    );
    return results.flat() as UltimaConsultaRecord[];
}
```

- [ ] **Step 2: Serviço**

Criar `backend/src/services/treatmentFollowUp.ts`:

```ts
import prisma from '../lib/prisma';
import { fetchUltimaConsulta, UltimaConsultaRecord } from '../lib/easydental';
import { normalizeCode } from '../lib/patientCode';
import { selectFollowUpRecords } from '../lib/followUp';

export interface FollowUpQuery {
    tenantId: string;
    dtInicio: string;
    dtTermino: string;
    unidades?: string[];
}

// Codigos (normalizados) dos pacientes com tratamento EM_ANDAMENTO no tenant.
// Vinculo SOMENTE pelo "Numero do Paciente" (patientNumber), como no appointmentSync.
const loadTreatmentCodes = async (tenantId: string): Promise<Set<string>> => {
    const treatments = await prisma.treatment.findMany({
        where: {
            status: 'EM_ANDAMENTO',
            OR: [
                { patient: { tenantId } },
                { planning: { patient: { tenantId } } },
            ],
        },
        select: {
            patient: { select: { patientNumber: true } },
            planning: { select: { patient: { select: { patientNumber: true } } } },
        },
    });

    const codes = new Set<string>();
    for (const treatment of treatments) {
        const patient = treatment.patient || treatment.planning?.patient;
        const code = normalizeCode(patient?.patientNumber);
        if (code) codes.add(code);
    }
    return codes;
};

// EasyDental ao vivo (modo estrito: erro de unidade nao vira lista vazia) x tratamentos do Planner.
export const findTreatmentsWithoutReschedule = async (query: FollowUpQuery): Promise<UltimaConsultaRecord[]> => {
    // Um tenantId indefinido viraria "sem filtro" no Prisma: nunca prosseguir sem ele.
    if (!query.tenantId) throw new Error('tenantId é obrigatório');

    const [records, treatmentCodes] = await Promise.all([
        fetchUltimaConsulta(query.dtInicio, query.dtTermino, query.unidades, { strict: true }),
        loadTreatmentCodes(query.tenantId),
    ]);
    return selectFollowUpRecords(records, treatmentCodes);
};

// Refaz a busca ao vivo e devolve, dos `codigos` recebidos, os que continuam elegiveis.
export const revalidateFollowUp = async (query: FollowUpQuery & { codigos: string[] }): Promise<string[]> => {
    const eligible = await findTreatmentsWithoutReschedule(query);
    const eligibleCodes = new Set(eligible.map((rec) => normalizeCode(rec.CODIGO)));
    return query.codigos.filter((codigo) => {
        const normalized = normalizeCode(codigo);
        return normalized !== null && eligibleCodes.has(normalized);
    });
};

// Tenant do usuario que criou um agendamento (cron nao tem usuario logado).
export const resolveTenantByUserId = async (userId: string): Promise<string | null> => {
    if (!userId || userId === 'system') return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    return user?.tenantId ?? null;
};
```

- [ ] **Step 3: Controller**

Criar `backend/src/controllers/followUpController.ts`:

```ts
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
```

- [ ] **Step 4: Rotas**

Em `backend/src/index.ts`, após o import de `messageTemplateController`, adicionar:

```ts
import { searchFollowUpTreatments, revalidateFollowUpTreatments } from './controllers/followUpController';
```

Após o bloco `// EasyDental RPC Proxy Routes` (depois da linha `app.post('/api/easydental/prestador/link', ...)`), adicionar:

```ts

// Follow-up Planner x Disparador (pacientes em tratamento sem reagendamento)
app.post('/api/follow-up/treatments', authMiddleware, requireAppAccess('disparos'), searchFollowUpTreatments);
app.post('/api/follow-up/treatments/revalidate', authMiddleware, requireAppAccess('disparos'), revalidateFollowUpTreatments);
```

- [ ] **Step 5: Verificar**

Run (em `backend/`): `npx tsc --noEmit && npm test`
Expected: sem erros de tipo; testes continuam `# pass 18`. (O comportamento HTTP é verificado na Task 6.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/easydental.ts backend/src/services/treatmentFollowUp.ts backend/src/controllers/followUpController.ts backend/src/index.ts
git commit -m "feat(disparos): busca e revalidacao de pacientes em tratamento sem reagendamento"
```

---

### Task 3: Cron dos Disparos Agendados

**Files:**
- Modify: `backend/src/jobs/disparoCron.ts` (imports linhas 1-3; início de `executeScheduledDisparo` ~linha 150-154; cadeia de modos ~linhas 221-258; linhas 306, 396, 409, 416, 417)

**Interfaces:**
- Consumes: `FOLLOW_UP_SEARCH_MODE` (Task 1); `findTreatmentsWithoutReschedule`, `resolveTenantByUserId` (Task 2).
- Produces: `executeScheduledDisparo` aceita `schedule.searchMode === 'tratamento-sem-reagendamento'`. Os registros têm o mesmo formato dos de `ultima-consulta`, então o novo modo usa o mesmo formato de payload (sem `data_agendamento`; `data` = última consulta; `inicio` vazio).

- [ ] **Step 1: Imports**

Após `import type { ScheduledDisparo } from '@prisma/client';`, adicionar:

```ts
import { FOLLOW_UP_SEARCH_MODE } from '../lib/followUp';
import { findTreatmentsWithoutReschedule, resolveTenantByUserId } from '../services/treatmentFollowUp';
```

- [ ] **Step 2: Flag de formato**

Em `executeScheduledDisparo`, logo após `const dtTermino = offsetDate(schedule.dtTerminoOffset);`, adicionar:

```ts
    // Os dois modos usam registros no formato do RPCGetUltimaConsulta
    const usesUltimaConsultaFormat =
        schedule.searchMode === 'ultima-consulta' || schedule.searchMode === FOLLOW_UP_SEARCH_MODE;
```

- [ ] **Step 3: Ramo de busca**

Na cadeia `if (schedule.searchMode === 'aniversario') { ... } else if (schedule.searchMode === 'ultima-consulta') { ... } else { ... }`, inserir ENTRE o fim do ramo `'ultima-consulta'` e o `} else {` final (o ramo padrão `agendamento`) o novo ramo:

```ts
        } else if (schedule.searchMode === FOLLOW_UP_SEARCH_MODE) {
            // Sem usuario logado no cron: o tenant vem do usuario que criou o agendamento.
            const tenantId = await resolveTenantByUserId(schedule.createdBy);
            if (!tenantId) {
                throw new Error('Não foi possível determinar o tenant do agendamento (usuário criador inválido). Recrie o agendamento com um usuário válido.');
            }
            agendamentos = await findTreatmentsWithoutReschedule({
                tenantId,
                dtInicio,
                dtTermino,
                unidades: schedule.unidades,
            });
```

(O `throw` cai no `catch` já existente, que marca o log como `failed` com a mensagem.)

- [ ] **Step 4: Usar a flag nos pontos de formato**

Trocar, exatamente nestas ocorrências, `schedule.searchMode === 'ultima-consulta'` por `usesUltimaConsultaFormat`:

1. No laço de deduplicação (~linha 306): `} else if (schedule.searchMode === 'ultima-consulta') {` → `} else if (usesUltimaConsultaFormat) {`
2. Na montagem do payload (~linha 396): `} else if (schedule.searchMode === 'ultima-consulta') {` → `} else if (usesUltimaConsultaFormat) {`
3. `data_agendamento` (~linha 409): `(schedule.searchMode === 'aniversario' || schedule.searchMode === 'ultima-consulta')` → `(schedule.searchMode === 'aniversario' || usesUltimaConsultaFormat)`
4. `data` (~linha 416): `schedule.searchMode === 'ultima-consulta' ? (ag.ULTIMA_CONSULTA || '') : dataAg` → `usesUltimaConsultaFormat ? (ag.ULTIMA_CONSULTA || '') : dataAg`
5. `inicio` (~linha 417): `schedule.searchMode === 'ultima-consulta' ? '' : horaAg` → `usesUltimaConsultaFormat ? '' : horaAg`

NÃO mexer na linha do ramo de busca `else if (schedule.searchMode === 'ultima-consulta') {` (~linha 221): ela continua usando o RPC direto.

- [ ] **Step 5: Verificar**

Run (em `backend/`): `npx tsc --noEmit && npm test`
Expected: sem erros; `# pass 18`.

Confirmar com `grep -n "'ultima-consulta'" backend/src/jobs/disparoCron.ts` que só restam: a linha da cadeia de busca (~221), a definição de `usesUltimaConsultaFormat` e as linhas de `aniversario` não relacionadas.

- [ ] **Step 6: Commit**

```bash
git add backend/src/jobs/disparoCron.ts
git commit -m "feat(disparos): ramo do cron para pacientes em tratamento sem reagendamento"
```

---

### Task 4: Disparador (aba Manual): busca, revalidação e envio

**Files:**
- Modify: `apps/disparos/src/services/api.ts` (após `getAniversarios`, ~linha 121)
- Modify: `apps/disparos/src/App.tsx` (constantes ~linha 131; `isFollowUp` após `currentPreset` ~linha 187; `handleSearch` ~linhas 357-475; `handleSend` ~linhas 478-587; `handleModelChange` ~linhas 606-636)

**Interfaces:**
- Consumes: `POST /api/follow-up/treatments` e `/revalidate` (Task 2).
- Produces: `api.getFollowUpTreatments(dtInicio, dtTermino, unidades) → { success, data }` e `api.revalidateFollowUp(dtInicio, dtTermino, unidades, codigos) → { success, eligible }`.

- [ ] **Step 1: API do frontend**

Em `apps/disparos/src/services/api.ts`, após a função `getAniversarios` (e antes de `// Message Templates`), adicionar:

```ts
    // Pacientes em tratamento (Planner) sem consulta reagendada (EasyDental ao vivo)
    getFollowUpTreatments: (dtInicio: string, dtTermino: string, unidades: string[]) =>
        request<{ success: boolean; data: any[] }>('/follow-up/treatments', {
            method: 'POST',
            body: JSON.stringify({ dt_inicio: dtInicio, dt_termino: dtTermino, unidades }),
        }),

    revalidateFollowUp: (dtInicio: string, dtTermino: string, unidades: string[], codigos: string[]) =>
        request<{ success: boolean; eligible: string[] }>('/follow-up/treatments/revalidate', {
            method: 'POST',
            body: JSON.stringify({ dt_inicio: dtInicio, dt_termino: dtTermino, unidades, codigos }),
        }),
```

- [ ] **Step 2: Constantes e `isFollowUp` em `App.tsx`**

Após o bloco `const FALLBACK_PRESETS ... };` (~linha 134), adicionar:

```tsx
const FOLLOW_UP_MODE = 'tratamento-sem-reagendamento';
// Janela da data da ultima consulta: inicio = dayOffset do modelo - 150 (ex.: -30 => de -180 a -30)
const FOLLOW_UP_WINDOW_DAYS = 150;
```

Logo após o `useMemo` de `currentPreset` (termina ~linha 187, antes do comentário `// Auth: read token...`), adicionar:

```tsx
    // Modo "em tratamento sem reagendamento": derivado do modelo escolhido (sem estado extra que possa dessincronizar)
    const isFollowUp = useMemo(
        () => isUltimaConsulta && messageTemplates.find(t => t.code === selectedModel)?.searchMode === FOLLOW_UP_MODE,
        [isUltimaConsulta, messageTemplates, selectedModel]
    );
```

- [ ] **Step 3: Pesquisa**

No ramo `} else if (isUltimaConsulta) {` de `handleSearch`, trocar:

```tsx
                const res = await api.getUltimaConsulta(
                    filters.dtInicio,
                    filters.dtTermino,
                    filters.unidades
                );
```

por:

```tsx
                const fetchRecords = isFollowUp ? api.getFollowUpTreatments : api.getUltimaConsulta;
                const res = await fetchRecords(filters.dtInicio, filters.dtTermino, filters.unidades);
```

E trocar o final do `useCallback` de `handleSearch`, a linha `}, [filters, selectedModel, isUltimaConsulta, isAniversario]);`, por:

```tsx
    }, [filters, selectedModel, isUltimaConsulta, isAniversario, isFollowUp]);
```

- [ ] **Step 4: Envio com revalidação**

Em `handleSend`, trocar o início:

```tsx
        const toSend = filteredMessages.filter(m => selectedIds.has(m.id) && m.status === 'pending');
        if (toSend.length === 0) {
            toast.error('Nenhuma mensagem selecionada para envio');
            return;
        }
```

por:

```tsx
        let toSend = filteredMessages.filter(m => selectedIds.has(m.id) && m.status === 'pending');
        if (toSend.length === 0) {
            toast.error('Nenhuma mensagem selecionada para envio');
            return;
        }

        // Antes de enviar, confirma ao vivo no EasyDental quem continua sem reagendar.
        // Se nao for possivel confirmar, NAO envia nada.
        if (isFollowUp) {
            let eligible: Set<string>;
            try {
                const res = await api.revalidateFollowUp(
                    filters.dtInicio,
                    filters.dtTermino,
                    filters.unidades,
                    toSend.map(m => m.codPaciente)
                );
                eligible = new Set(res.eligible);
            } catch (err: any) {
                toast.error('Não foi possível confirmar a situação dos pacientes no EasyDental. Nenhuma mensagem foi enviada. ' + err.message);
                setShowSendModal(false);
                return;
            }

            const skipped = toSend.filter(m => !eligible.has(m.codPaciente));
            if (skipped.length > 0) {
                const skippedIds = new Set(skipped.map(m => m.id));
                setMessages(prev => prev.map(m =>
                    skippedIds.has(m.id) ? { ...m, status: 'error' as const, errorMessage: 'Já reagendou — não enviado' } : m
                ));
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    skippedIds.forEach(id => next.delete(id));
                    return next;
                });
                toast.info(`${skipped.length} paciente(s) já reagendaram e foram retirados do envio`);
                toSend = toSend.filter(m => eligible.has(m.codPaciente));
            }

            if (toSend.length === 0) {
                toast.error('Todos os pacientes selecionados já reagendaram. Nada a enviar.');
                setShowSendModal(false);
                return;
            }
        }
```

E trocar o final do `useCallback` de `handleSend`, a linha `}, [filteredMessages, selectedIds, sendConfig, selectedModel, isUltimaConsulta, isAniversario]);`, por:

```tsx
    }, [filteredMessages, selectedIds, sendConfig, selectedModel, isUltimaConsulta, isAniversario, isFollowUp, filters]);
```

- [ ] **Step 5: Datas do modelo**

Em `handleModelChange`, substituir o bloco `if (tpl) { ... }` inicial (da linha `if (tpl) {` até o fim do `if/else if/else` de `tpl.searchMode`, antes do `} else {` que trata o `fb`), por:

```tsx
        if (tpl) {
            const isFollowUpTpl = tpl.searchMode === FOLLOW_UP_MODE;
            const dateStr = dateOffset(tpl.dayOffset);
            // Em "tratamento sem reagendamento" a janela e a data da ultima consulta: de (dayOffset - 150) ate dayOffset
            const startStr = isFollowUpTpl ? dateOffset(tpl.dayOffset - FOLLOW_UP_WINDOW_DAYS) : dateStr;
            setFilters(prev => ({ ...prev, dtInicio: startStr, dtTermino: dateStr, statusAgendamento: [] }));

            if (tpl.searchMode === 'ultima-consulta' || isFollowUpTpl) {
                setIsUltimaConsulta(true);
                setIsAniversario(false);
                setOnlyWithoutScheduled(false);
            } else if (tpl.searchMode === 'aniversario') {
                setIsUltimaConsulta(false);
                setIsAniversario(true);
                setOnlyWithoutScheduled(false);
            } else {
                setIsUltimaConsulta(false);
                setIsAniversario(false);
            }
```

(O restante da função, a partir de `} else { const fb = ...`, fica como está.)

- [ ] **Step 6: Verificar**

Run (em `apps/disparos/`): `npm run build`
Expected: `tsc` sem erros e `vite build` conclui.

- [ ] **Step 7: Commit**

```bash
git add apps/disparos/src/services/api.ts apps/disparos/src/App.tsx
git commit -m "feat(disparos): busca e envio de pacientes em tratamento sem reagendamento na aba Manual"
```

---

### Task 5: Cadastro de modelos e de agendamentos com o novo modo

**Files:**
- Modify: `apps/disparos/src/components/MessageTemplatesTab.tsx` (constante antes do componente; linha ~246; tooltip ~382; select ~370)
- Modify: `apps/disparos/src/components/ScheduledDisparos.tsx` (select ~251-267; dica ~218-220; selo ~431)

**Interfaces:**
- Consumes: valor `tratamento-sem-reagendamento` (Global Constraints).
- Produces: usuário consegue escolher o modo ao criar um modelo e um agendamento; o selo/rótulo aparece nas listas.

- [ ] **Step 1: `MessageTemplatesTab.tsx`**

Antes da declaração do componente (logo após os imports), adicionar:

```tsx
const SEARCH_MODE_LABELS: Record<string, string> = {
    agendamento: 'Agendamento',
    'ultima-consulta': 'Última Consulta',
    aniversario: 'Aniversário',
    'tratamento-sem-reagendamento': 'Em tratamento sem reagendamento',
};
```

Trocar o rótulo do modo no cartão (~linha 246):

```tsx
Modo: <span className="font-semibold text-foreground">{tpl.searchMode === 'ultima-consulta' ? 'Última Consulta' : tpl.searchMode === 'aniversario' ? 'Aniversário' : 'Agendamento'}</span>
```

por:

```tsx
Modo: <span className="font-semibold text-foreground">{SEARCH_MODE_LABELS[tpl.searchMode || 'agendamento'] || 'Agendamento'}</span>
```

No `<select>` de "Modo de Busca" (~linha 370-371), após `<option value="aniversario">Aniversário</option>`, adicionar:

```tsx
                                            <option value="tratamento-sem-reagendamento">Em tratamento sem reagendamento</option>
```

No tooltip do "Deslocamento de Dias" (~linha 382), trocar o texto:

```tsx
                                                    Dias relativos a hoje. Ex: 1 para amanhã, -1 para ontem, 0 para hoje.
```

por:

```tsx
                                                    {searchMode === 'tratamento-sem-reagendamento'
                                                        ? 'Dias desde a última consulta (negativo). Ex: -30 busca quem teve a última consulta há 30 dias ou mais, nos 150 dias anteriores a isso.'
                                                        : 'Dias relativos a hoje. Ex: 1 para amanhã, -1 para ontem, 0 para hoje.'}
```

- [ ] **Step 2: `ScheduledDisparos.tsx`**

No `onChange` do select de "Modo de Busca" (~linhas 251-262), trocar o `set({...})` por:

```tsx
                        set({
                            searchMode: val,
                            ...(val !== 'agendamento' && {
                                statusAgendamento: [],
                                agendas: [],
                                periodos: [],
                                motivo: '',
                            }),
                            // Neste modo o periodo e a data da ultima consulta: padrao de 180 a 30 dias atras
                            ...(val === 'tratamento-sem-reagendamento' && {
                                dtInicioOffset: -180,
                                dtTerminoOffset: -30,
                            }),
                        });
```

Após `<option value="aniversario">Aniversário</option>` (~linha 266), adicionar:

```tsx
                    <option value="tratamento-sem-reagendamento">Em tratamento sem reagendamento</option>
```

Logo após o parágrafo de dica dos offsets (o `<p className="text-xs text-muted-foreground">` com "Negativo = dias passados...", ~linhas 218-220), adicionar:

```tsx
                {form.searchMode === 'tratamento-sem-reagendamento' && (
                    <p className="text-xs text-muted-foreground">
                        Neste modo o período é a <strong>data da última consulta</strong>. Ex: <strong>-180 até -30</strong> = pacientes em tratamento cuja última consulta foi entre 180 e 30 dias atrás e que ainda não reagendaram. A situação é confirmada ao vivo no EasyDental a cada execução.
                    </p>
                )}
```

Após o selo de `ultima-consulta` (~linha 431-433), adicionar:

```tsx
                        {schedule.searchMode === 'tratamento-sem-reagendamento' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">Sem reagendamento</span>
                        )}
```

Atenção: o selo `Agendamento` existente usa `(!schedule.searchMode || schedule.searchMode === 'agendamento')`, então não aparece no novo modo.

- [ ] **Step 3: Verificar**

Run (em `apps/disparos/`): `npm run build`
Expected: `tsc` sem erros e `vite build` conclui.

- [ ] **Step 4: Commit**

```bash
git add apps/disparos/src/components/MessageTemplatesTab.tsx apps/disparos/src/components/ScheduledDisparos.tsx
git commit -m "feat(disparos): opcao 'Em tratamento sem reagendamento' em modelos e agendamentos"
```

---

### Task 6: Deploy no host de teste e verificação (sem envio real)

**Pré-requisito:** Tasks 1-5 commitadas; `npm test` e `npx tsc --noEmit` (backend) e `npm run build` (disparos) passando. Esta tarefa é executada pelo controlador, não por subagente. NENHUMA mensagem real pode ser enviada.

**Files:** nenhum arquivo do repositório muda (exceto correções, se o teste revelar bugs).

- [ ] **Step 1: Enviar o branch**

```bash
git push -u origin feat/disparo-tratamento-sem-reagendamento
```

(Só este branch; nunca a `main`.)

- [ ] **Step 2: Atualizar o host e travar o webhook**

O clone do host acompanha só o branch dos dentistas; adicionar este:

```bash
ssh -i ~/.ssh/id_ed25519_casaos edmar@192.168.15.7 'bash -s' <<'EOS'
set -e
cd ~/ortho-ai-planner
git remote set-branches --add origin feat/disparo-tratamento-sem-reagendamento
git fetch origin feat/disparo-tratamento-sem-reagendamento
git checkout feat/disparo-tratamento-sem-reagendamento
git log --oneline -1
# Destino fictício inalcançável (vazio NÃO serve: o compose volta ao webhook real)
grep -q '^BOTCONVERSA_WEBHOOK_URL=' .env 2>/dev/null && sed -i 's#^BOTCONVERSA_WEBHOOK_URL=.*#BOTCONVERSA_WEBHOOK_URL=http://127.0.0.1:9/disabled#' .env || echo 'BOTCONVERSA_WEBHOOK_URL=http://127.0.0.1:9/disabled' >> .env
grep BOTCONVERSA .env
EOS
```

Expected: o commit do topo do branch e a linha `BOTCONVERSA_WEBHOOK_URL=http://127.0.0.1:9/disabled`.

- [ ] **Step 3: Reconstruir backend e Disparador**

```bash
ssh -i ~/.ssh/id_ed25519_casaos edmar@192.168.15.7 'cd ~/ortho-ai-planner && docker compose up -d --build backend disparos > ~/ortho-deploy2.log 2>&1; tail -n 5 ~/ortho-deploy2.log; docker compose ps --format "{{.Name}} {{.State}}"; docker compose logs backend 2>&1 | grep -E "Migrations applied|Migration failed|Server running|Seed completed" | tail -4'
```

Expected: `backend` e `disparos` em `running`; `Server running`. Contingência: o banco de teste já tem a migration `add_dentists` (do branch dos dentistas) que este branch não possui; `migrate deploy` costuma só avisar. Se falhar por isso, recriar o banco conforme a memória `project-cadastro-dentistas-e-host-teste` ou fazer o teste a partir de uma cópia do branch dos dentistas mesclada localmente.

- [ ] **Step 4: Dados de teste reais (somente leitura no EasyDental)**

Fazer login (`teste@dentistas.local` / `Teste12345`, Super Admin do banco de teste) e descobrir candidatos no EasyDental:

```bash
ssh -i ~/.ssh/id_ed25519_casaos edmar@192.168.15.7 'bash -s' <<'EOS'
B=http://localhost:5174
T=$(curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"email":"teste@dentistas.local","password":"Teste12345"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
FIM=$(date -d '-30 days' +%F); INI=$(date -d '-210 days' +%F)
curl -s -X POST $B/api/easydental/ultima-consulta -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d "{\"dt_inicio\":\"$INI\",\"dt_termino\":\"$FIM\",\"unidades\":[]}" > /tmp/uc.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/uc.json')).get('data',[])
sem=[r for r in d if not str(r.get('CONSULTA_AGENDADA') or '').strip() and r.get('CODIGO')]
com=[r for r in d if str(r.get('CONSULTA_AGENDADA') or '').strip() and r.get('CODIGO')]
print('registros:',len(d),'| sem agendamento:',len(sem),'| com agendamento:',len(com))
print('CODIGO_SEM=',sem[0]['CODIGO'] if sem else '')
print('CODIGO_COM=',com[0]['CODIGO'] if com else '')
PY
EOS
```

Anotar `CODIGO_SEM` (A, deve entrar na lista) e `CODIGO_COM` (B, deve sair). NÃO imprimir nem copiar nomes/telefones. Se não houver candidato de um dos tipos, ampliar a janela e repetir.

Criar no banco de teste: uma clínica (`POST /api/clinics`) e, com `x-clinic-id` dessa clínica, três pacientes (`POST /api/patients` com `name`, `cpf` válido e distinto por paciente e `patientNumber`): um com o código A, um com o código B e um com o número inexistente `999999` (C). Para cada paciente, criar um tratamento (`POST /api/treatments` com `patientId` e `status: "EM_ANDAMENTO"`).

- [ ] **Step 5: Verificar busca e revalidação**

Com `T` e a janela do passo 4 (`$INI`..`$FIM`); as rotas novas não usam clínica:

1. `POST /api/follow-up/treatments` → `success: true`; a lista contém o código A; NÃO contém B (tem consulta agendada) nem C (não existe no EasyDental). Conferir só por `CODIGO`.
2. `POST /api/follow-up/treatments/revalidate` com `codigos: [A, B, "999999"]` → `eligible` igual a `[A]`.
3. Sem token → 401. Com datas impossíveis (`"2026-02-30"`) → 400 com a mensagem em português. `codigos` ausente na revalidação → 400.
4. Isolamento por tenant: criar, dentro do container, um segundo tenant com um usuário Super Admin:
   ```bash
   docker compose exec -T backend node -e "
   const { PrismaClient } = require('@prisma/client'); const bcrypt = require('bcryptjs');
   (async () => { const p = new PrismaClient();
     const t = await p.tenant.create({ data: { name: 'Tenant B (teste)' } });
     await p.user.create({ data: { email: 'outro@tenant.local', password: bcrypt.hashSync('Teste12345', 10), name: 'Outro Tenant', tenantId: t.id, isSuperAdmin: true } });
     await p.\$disconnect(); })();"
   ```
   Fazer login com `outro@tenant.local` e repetir o passo 1: a lista deve vir VAZIA (esse tenant não tem tratamentos), provando que o tenant vem do token. Se o modelo `Tenant` exigir outros campos, ajustar o `create` conforme `backend/prisma/schema.prisma`.
5. "Reagendou nesse meio-tempo": o EasyDental é a fonte da verdade e não será alterado; validar pela contrapartida: a revalidação com `[B]` (que já tem consulta) devolve `eligible: []`.

- [ ] **Step 6: Verificar o cron (sem envio real)**

1. Criar via API um modelo de mensagem e um agendamento (o webhook é fictício, então nada sai):
   - `POST /api/message-templates` com `{"name":"Em tratamento sem reagendamento","category":"utilidade","code":"tsr-1","dayOffset":-30,"searchMode":"tratamento-sem-reagendamento"}`.
   - `POST /api/scheduled-disparos` com `searchMode: "tratamento-sem-reagendamento"`, `modelo: "tsr-1"`, `dtInicioOffset: -210`, `dtTerminoOffset: -30`, `cronExpression: "0 3 1 1 *"` (não dispara sozinho), `isActive: false`.
2. `POST /api/scheduled-disparos/<id>/trigger`; aguardar alguns segundos e `GET /api/scheduled-disparos/<id>/logs`: o log mais recente deve estar `completed` com `totalFetched` ≥ 1 e `totalProcessed` ≥ 1 (o paciente A); como o webhook é inalcançável, `totalSent` = 0 e `totalErrors` ≥ 1. Confirmar nos logs do backend que não houve envio real.
3. Criar um segundo agendamento com `createdBy` inválido, direto no banco (a API sempre grava o usuário logado):
   ```bash
   docker compose exec -T backend node -e "
   const { PrismaClient } = require('@prisma/client');
   (async () => { const p = new PrismaClient();
     const s = await p.scheduledDisparo.create({ data: { name: 'Teste createdBy invalido', cronExpression: '0 3 1 1 *', isActive: false, searchMode: 'tratamento-sem-reagendamento', modelo: 'tsr-1', dtInicioOffset: -210, dtTerminoOffset: -30, createdBy: 'system' } });
     console.log(s.id); await p.\$disconnect(); })();"
   ```
   Disparar com `/trigger` e consultar `/logs`: o log deve estar `failed` com a mensagem `Não foi possível determinar o tenant do agendamento...`, e nenhum envio.

- [ ] **Step 7: Verificação visual (usuário)**

Pedir ao usuário para abrir `http://192.168.15.7:5175`, entrar, ir na aba Manual, escolher o modelo "Em tratamento sem reagendamento", conferir que as datas vêm preenchidas (−180 a −30), pesquisar e ver a lista; selecionar e clicar em Enviar apenas para ver a revalidação (o webhook é fictício: os envios falham sem sair do servidor). Conferir que quem reagendou aparece como "Já reagendou — não enviado".

- [ ] **Step 8: Registrar o resultado**

Informar ao usuário o resultado de cada item (passou/falhou, com a evidência) e lembrar: o host continua com o webhook fictício; para uso real, o `.env` do ambiente de produção é outro. Se algo falhou, corrigir com commit novo e repetir os passos 3 a 6 (com `git pull` no host e `docker compose up -d --build backend disparos`).
