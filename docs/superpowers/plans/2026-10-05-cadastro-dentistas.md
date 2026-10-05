# Cadastro de Dentistas por Clínica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada clínica mantém uma lista de dentistas (ID EasyDental, Nome, CRO); ao criar planejamento, tratamento ou termo o usuário seleciona o dentista e o CRO é preenchido automaticamente.

**Architecture:** Novo model Prisma `Dentist` (por clínica) com FK opcional em `Planning` e `Treatment`. Nome/CRO continuam gravados como cópia no registro. API REST `/api/dentists` filtrada pela clínica do header `x-clinic-id`. No frontend, um serviço, um `DentistSelect` reutilizável e uma aba "Dentistas" em `ClinicSettings`.

**Tech Stack:** Node 20 + Express + Prisma 6 (PostgreSQL) no backend; React + Vite + shadcn/ui + sonner no `apps/planner`; testes unitários com `node:test` via `ts-node` (o backend não tem framework de teste e não vamos adicionar dependências).

## Global Constraints

- Escopo por clínica: todo acesso a `Dentist` filtra por `clinicId` da clínica atual (header `x-clinic-id`), e a clínica deve pertencer ao `tenantId` do usuário.
- Campos do cadastro: apenas ID do EasyDental (opcional, texto), Nome (obrigatório) e CRO (obrigatório). Mais `isActive` interno.
- `@@unique([clinicId, cro])`; CRO é normalizado (trim, espaços colapsados, maiúsculas) antes de gravar.
- `Treatment.doctorName` continua existindo como cópia; `Planning` só ganha `dentistId` (nome/CRO do planejamento já vivem em `structuredPlan.nomeOrtodontista` / `croOrtodontista`).
- Migration somente aditiva (colunas opcionais), em `backend/prisma/migrations/<timestamp>_<nome>/migration.sql` (produção roda `prisma migrate deploy` no `start.sh`).
- `DELETE /api/dentists/:id` remove se não houver vínculos; com vínculos apenas desativa (`isActive=false`).
- Permissões: listar = `read`/`planning`; criar, editar, excluir = `manage`/`clinic`. Todas com `requireAppAccess('planner')`.
- Mensagens de erro e textos de UI em português.
- Dados antigos: tratamentos com `doctorName` em texto continuam exibidos como estão.
- Ambiente de teste: host remoto 192.168.15.7 (CasaOS) via git. Nada de docker nesta máquina. **Push, SSH e deploy só com confirmação do usuário.** Nunca gravar a senha do host em arquivo, commit ou memória.

## File Structure

Backend (`backend/`):
- Modify `prisma/schema.prisma` — model `Dentist`, relações em `Clinic`, `Planning`, `Treatment`.
- Create `prisma/migrations/20261005120000_add_dentists/migration.sql`.
- Create `src/lib/dentist.ts` — validação/normalização pura (testável sem banco).
- Create `src/lib/dentist.test.ts` — testes `node:test`.
- Create `src/services/dentists.ts` — `findActiveClinicDentist`.
- Create `src/controllers/dentistController.ts` — CRUD.
- Modify `src/controllers/treatmentController.ts`, `src/controllers/planningController.ts` — aceitar `dentistId`.
- Modify `src/index.ts` — rotas.
- Modify `tsconfig.json`, `package.json` — excluir testes do build e script `test`.

Frontend (`apps/planner/src/`):
- Create `services/dentistService.ts`, `components/DentistSelect.tsx`, `components/DentistManager.tsx`.
- Modify `pages/ClinicSettings.tsx` (abas), `services/patientService.ts` (tipos), `pages/NovoPlanejamentoIA.tsx`, `pages/Tratamento.tsx`, `pages/TermoDeCompromisso.tsx`, `pages/Dashboard.tsx`.

---

### Task 1: Modelo de dados, migration e validação pura

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261005120000_add_dentists/migration.sql`
- Create: `backend/src/lib/dentist.ts`
- Test: `backend/src/lib/dentist.test.ts`
- Modify: `backend/tsconfig.json`, `backend/package.json`

**Interfaces:**
- Produces (`backend/src/lib/dentist.ts`):
  ```ts
  export interface DentistInput { name: string; cro: string; easyDentalId: string | null; }
  export type DentistInputResult = { ok: true; data: DentistInput } | { ok: false; error: string };
  export const normalizeCro: (value: unknown) => string;
  export const parseDentistInput: (body: unknown) => DentistInputResult;
  ```
- Produces (Prisma): `prisma.dentist` com campos `id, clinicId, easyDentalId, name, cro, isActive, createdAt, updatedAt`; `Planning.dentistId`; `Treatment.dentistId`, `Treatment.dentistCro`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/src/lib/dentist.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCro, parseDentistInput } from './dentist';

test('normalizeCro remove espaços extras e coloca em maiúsculas', () => {
    assert.equal(normalizeCro('  sp   12345 '), 'SP 12345');
});

test('normalizeCro devolve vazio para valores não-texto', () => {
    assert.equal(normalizeCro(undefined), '');
    assert.equal(normalizeCro(123), '');
});

test('parseDentistInput aceita dados válidos e normaliza', () => {
    const result = parseDentistInput({ name: '  Ana   Souza ', cro: 'sp-123', easyDentalId: ' 77 ' });
    assert.deepEqual(result, { ok: true, data: { name: 'Ana Souza', cro: 'SP-123', easyDentalId: '77' } });
});

test('parseDentistInput converte easyDentalId numérico em texto e vazio em null', () => {
    const numeric = parseDentistInput({ name: 'A', cro: '1', easyDentalId: 42 });
    assert.deepEqual(numeric, { ok: true, data: { name: 'A', cro: '1', easyDentalId: '42' } });
    const empty = parseDentistInput({ name: 'A', cro: '1', easyDentalId: '  ' });
    assert.deepEqual(empty, { ok: true, data: { name: 'A', cro: '1', easyDentalId: null } });
});

test('parseDentistInput exige nome', () => {
    assert.deepEqual(parseDentistInput({ name: '  ', cro: '1' }), { ok: false, error: 'Nome é obrigatório' });
});

test('parseDentistInput exige CRO', () => {
    assert.deepEqual(parseDentistInput({ name: 'A', cro: '' }), { ok: false, error: 'CRO é obrigatório' });
});

test('parseDentistInput rejeita corpo inválido', () => {
    assert.deepEqual(parseDentistInput(null), { ok: false, error: 'Nome é obrigatório' });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `backend/`): `node --require ts-node/register --test src/lib/dentist.test.ts`
Expected: FAIL com `Cannot find module './dentist'`.

- [ ] **Step 3: Implementar o módulo**

Criar `backend/src/lib/dentist.ts`:

```ts
export interface DentistInput {
    name: string;
    cro: string;
    easyDentalId: string | null;
}

export type DentistInputResult =
    | { ok: true; data: DentistInput }
    | { ok: false; error: string };

const collapse = (value: string) => value.trim().replace(/\s+/g, ' ');

export const normalizeCro = (value: unknown): string =>
    typeof value === 'string' ? collapse(value).toUpperCase() : '';

export const parseDentistInput = (body: unknown): DentistInputResult => {
    const raw = (body ?? {}) as Record<string, unknown>;
    const name = typeof raw.name === 'string' ? collapse(raw.name) : '';
    const cro = normalizeCro(raw.cro);

    if (!name) return { ok: false, error: 'Nome é obrigatório' };
    if (!cro) return { ok: false, error: 'CRO é obrigatório' };

    let easyDentalId: string | null = null;
    if (typeof raw.easyDentalId === 'string') easyDentalId = raw.easyDentalId.trim() || null;
    else if (typeof raw.easyDentalId === 'number') easyDentalId = String(raw.easyDentalId);

    return { ok: true, data: { name, cro, easyDentalId } };
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --require ts-node/register --test src/lib/dentist.test.ts`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 5: Script de teste e exclusão do build**

Em `backend/package.json`, trocar a linha do script `test`:

```json
    "test": "node --require ts-node/register --test src/lib/*.test.ts",
```

Em `backend/tsconfig.json`, trocar o `exclude`:

```json
    "exclude": [
        "node_modules",
        "src/**/*.test.ts"
    ]
```

Run: `npm test` (em `backend/`). Expected: `# pass 7`.

- [ ] **Step 6: Schema Prisma**

Em `backend/prisma/schema.prisma`:

1. No model `Clinic`, dentro das relações (junto às demais, antes do `}` do model), adicionar:
   ```prisma
     dentists    Dentist[]
   ```
2. No model `Planning`, adicionar o campo e a relação:
   ```prisma
     dentistId      String?
     dentist        Dentist?   @relation(fields: [dentistId], references: [id], onDelete: SetNull)
   ```
3. No model `Treatment` (mesmo estilo sem indentação do model), adicionar:
   ```prisma
   dentistId String?
   dentistCro String? // CRO do dentista no momento do vínculo (cópia)
   dentist Dentist? @relation(fields: [dentistId], references: [id], onDelete: SetNull)
   ```
4. Adicionar o novo model ao final do arquivo:
   ```prisma
   model Dentist {
     id           String      @id @default(uuid())
     clinicId     String
     easyDentalId String?
     name         String
     cro          String
     isActive     Boolean     @default(true)
     createdAt    DateTime    @default(now())
     updatedAt    DateTime    @updatedAt
     clinic       Clinic      @relation(fields: [clinicId], references: [id], onDelete: Cascade)
     plannings    Planning[]
     treatments   Treatment[]

     @@unique([clinicId, cro])
   }
   ```

Run (em `backend/`): `npx prisma validate && npx prisma generate`
Expected: `The schema at prisma\schema.prisma is valid` e client gerado sem erro.

- [ ] **Step 7: Migration SQL**

Criar `backend/prisma/migrations/20261005120000_add_dentists/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "Dentist" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "easyDentalId" TEXT,
    "name" TEXT NOT NULL,
    "cro" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dentist_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Planning" ADD COLUMN "dentistId" TEXT;
ALTER TABLE "Treatment" ADD COLUMN "dentistId" TEXT;
ALTER TABLE "Treatment" ADD COLUMN "dentistCro" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Dentist_clinicId_cro_key" ON "Dentist"("clinicId", "cro");

-- AddForeignKey
ALTER TABLE "Dentist" ADD CONSTRAINT "Dentist_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "Dentist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "Dentist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

(A aplicação real da migration é verificada na Task 7, no banco do host remoto.)

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20261005120000_add_dentists backend/src/lib/dentist.ts backend/src/lib/dentist.test.ts backend/tsconfig.json backend/package.json
git commit -m "feat(dentistas): model Dentist, migration e validacao de entrada"
```

---

### Task 2: API CRUD de dentistas

**Files:**
- Create: `backend/src/services/dentists.ts`
- Create: `backend/src/controllers/dentistController.ts`
- Modify: `backend/src/index.ts` (imports ~linha 27; rotas após o bloco "Clinic Routes", ~linha 104)

**Interfaces:**
- Consumes: `parseDentistInput` de `../lib/dentist`; `prisma` de `../lib/prisma`; `AuthRequest` de `../middleware/authMiddleware`.
- Produces:
  ```ts
  // services/dentists.ts
  export const findActiveClinicDentist: (dentistId: string, clinicId: string | undefined) => Promise<Dentist | null>;
  // controllers/dentistController.ts
  export const listDentists, createDentist, updateDentist, deleteDentist: (req: AuthRequest, res: Response) => Promise<...>;
  ```
- Rotas: `GET/POST /api/dentists`, `PUT/DELETE /api/dentists/:id`. Resposta de `Dentist`: `{ id, clinicId, easyDentalId, name, cro, isActive, createdAt, updatedAt }`. `DELETE` responde `{ deleted: true }` ou `{ deactivated: true }`.

- [ ] **Step 1: Serviço de busca**

Criar `backend/src/services/dentists.ts`:

```ts
import prisma from '../lib/prisma';

// clinicId indefinido NUNCA pode virar filtro vazio no Prisma (undefined = sem filtro).
export const findActiveClinicDentist = async (dentistId: string, clinicId: string | undefined) => {
    if (!clinicId) return null;
    return prisma.dentist.findFirst({
        where: { id: dentistId, clinicId, isActive: true }
    });
};
```

- [ ] **Step 2: Controller**

Criar `backend/src/controllers/dentistController.ts`:

```ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { parseDentistInput } from '../lib/dentist';

const DUPLICATE_CRO_ERROR = 'Já existe um dentista com este CRO nesta clínica';

// A clínica vem do header x-clinic-id e precisa pertencer ao tenant do usuário.
const resolveClinic = async (req: AuthRequest) => {
    const { clinicId, tenantId } = req;
    if (!clinicId || !tenantId) return null;
    return prisma.clinic.findFirst({ where: { id: clinicId, tenantId } });
};

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === 'P2002';

export const listDentists = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const includeInactive = req.query.includeInactive === 'true';
        const dentists = await prisma.dentist.findMany({
            where: { clinicId: clinic.id, ...(includeInactive ? {} : { isActive: true }) },
            orderBy: { name: 'asc' }
        });
        res.json(dentists);
    } catch (error) {
        console.error('Error listing dentists:', error);
        res.status(500).json({ error: 'Erro ao buscar dentistas' });
    }
};

export const createDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const parsed = parseDentistInput(req.body);
        if (!parsed.ok) return res.status(400).json({ error: parsed.error });

        const dentist = await prisma.dentist.create({
            data: { ...parsed.data, clinicId: clinic.id }
        });
        res.status(201).json(dentist);
    } catch (error) {
        if (isUniqueViolation(error)) return res.status(409).json({ error: DUPLICATE_CRO_ERROR });
        console.error('Error creating dentist:', error);
        res.status(500).json({ error: 'Erro ao criar dentista' });
    }
};

export const updateDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const existing = await prisma.dentist.findFirst({ where: { id, clinicId: clinic.id } });
        if (!existing) return res.status(404).json({ error: 'Dentista não encontrado' });

        const parsed = parseDentistInput(req.body);
        if (!parsed.ok) return res.status(400).json({ error: parsed.error });

        const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : existing.isActive;
        const updated = await prisma.dentist.update({
            where: { id },
            data: { ...parsed.data, isActive }
        });
        res.json(updated);
    } catch (error) {
        if (isUniqueViolation(error)) return res.status(409).json({ error: DUPLICATE_CRO_ERROR });
        console.error('Error updating dentist:', error);
        res.status(500).json({ error: 'Erro ao atualizar dentista' });
    }
};

export const deleteDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const existing = await prisma.dentist.findFirst({
            where: { id, clinicId: clinic.id },
            include: { _count: { select: { plannings: true, treatments: true } } }
        });
        if (!existing) return res.status(404).json({ error: 'Dentista não encontrado' });

        if (existing._count.plannings + existing._count.treatments > 0) {
            await prisma.dentist.update({ where: { id }, data: { isActive: false } });
            return res.json({ deactivated: true });
        }

        await prisma.dentist.delete({ where: { id } });
        res.json({ deleted: true });
    } catch (error) {
        console.error('Error deleting dentist:', error);
        res.status(500).json({ error: 'Erro ao excluir dentista' });
    }
};
```

- [ ] **Step 3: Registrar as rotas**

Em `backend/src/index.ts`, após o import de `messageTemplateController` (linha 27), adicionar:

```ts
import { listDentists, createDentist, updateDentist, deleteDentist } from './controllers/dentistController';
```

Após o bloco `// Clinic Routes` (depois da linha `app.delete('/api/clinics/:id', ...)`), adicionar:

```ts
// Dentist Routes (por clínica)
app.get('/api/dentists', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), listDentists);
app.post('/api/dentists', authMiddleware, requireAppAccess('planner'), requirePermission('manage', 'clinic'), createDentist);
app.put('/api/dentists/:id', authMiddleware, requireAppAccess('planner'), requirePermission('manage', 'clinic'), updateDentist);
app.delete('/api/dentists/:id', authMiddleware, requireAppAccess('planner'), requirePermission('manage', 'clinic'), deleteDentist);
```

- [ ] **Step 4: Verificar compilação**

Run (em `backend/`): `npx prisma generate && npx tsc --noEmit`
Expected: sem erros. (O comportamento HTTP é verificado no smoke test da Task 7.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/dentists.ts backend/src/controllers/dentistController.ts backend/src/index.ts
git commit -m "feat(dentistas): API CRUD de dentistas por clinica"
```

---

### Task 3: Planejamento e tratamento aceitam `dentistId`

**Files:**
- Modify: `backend/src/controllers/treatmentController.ts` (`createTreatment` ~linhas 123-210, `updateTreatment` ~linhas 213-256)
- Modify: `backend/src/controllers/planningController.ts` (`createPlanning` ~40-76, `updatePlanning` ~79-116)

**Interfaces:**
- Consumes: `findActiveClinicDentist(dentistId, clinicId)` de `../services/dentists`.
- Produces: `POST/PUT /api/treatments` e `POST/PUT /api/plannings` aceitam `dentistId: string | null`. Dentista inexistente, inativo ou de outra clínica → `400 { error: 'Dentista inválido para esta clínica' }`. Em tratamento, vincular grava `doctorName = dentist.name` e `dentistCro = dentist.cro`; `dentistId` nulo/vazio na atualização limpa `dentistId` e `dentistCro`.

- [ ] **Step 1: treatmentController — import**

Em `backend/src/controllers/treatmentController.ts`, após o import de `syncTreatmentAppointments`, adicionar:

```ts
import { findActiveClinicDentist } from '../services/dentists';
```

- [ ] **Step 2: treatmentController — create**

Em `createTreatment`: incluir `dentistId` na desestruturação do body:

```ts
const { planningId, patientId, startDate, deadline, endDate, lastAppointment, nextAppointment, notes, status, doctorName, dentistId } = req.body;
```

Imediatamente antes de `const treatment = await prisma.treatment.create({`, adicionar:

```ts
let dentistData: { dentistId?: string; doctorName?: string; dentistCro?: string } = {};
if (dentistId) {
const dentist = await findActiveClinicDentist(dentistId, clinicId);
if (!dentist) {
return res.status(400).json({ error: 'Dentista inválido para esta clínica' });
}
dentistData = { dentistId: dentist.id, doctorName: dentist.name, dentistCro: dentist.cro };
}

```

E no objeto `data` do `create`, trocar a linha `doctorName: doctorName || null` por:

```ts
doctorName: doctorName || null,
...dentistData
```

- [ ] **Step 3: treatmentController — update**

Em `updateTreatment`: incluir `dentistId` na desestruturação:

```ts
const { startDate, deadline, endDate, lastAppointment, nextAppointment, notes, status, doctorName, dentistId } = req.body;
```

Após o bloco `if (!treatment) { ... 404 ... }` e antes de `const updated = await prisma.treatment.update({`, adicionar:

```ts
let dentistData: { dentistId?: string | null; doctorName?: string; dentistCro?: string | null } = {};
if (dentistId === null || dentistId === '') {
dentistData = { dentistId: null, dentistCro: null };
} else if (dentistId !== undefined && dentistId !== treatment.dentistId) {
const dentist = await findActiveClinicDentist(dentistId, clinicId);
if (!dentist) {
return res.status(400).json({ error: 'Dentista inválido para esta clínica' });
}
dentistData = { dentistId: dentist.id, doctorName: dentist.name, dentistCro: dentist.cro };
}

```

E no `data` do `update`, trocar a linha `...(doctorName !== undefined && { doctorName })` por:

```ts
...(doctorName !== undefined && { doctorName }),
...dentistData
```

- [ ] **Step 4: planningController — import e create**

Em `backend/src/controllers/planningController.ts`, após o import de `hasPermission`, adicionar:

```ts
import { findActiveClinicDentist } from '../services/dentists';
```

Em `createPlanning`, trocar a desestruturação por:

```ts
        const { patientId, title, originalReport, status, structuredPlan, dentistId } = req.body;
```

Após o bloco `if (!patient) { ... 404 ... }` e antes de `const planning = await prisma.planning.create({`, adicionar:

```ts
        let validDentistId: string | null = null;
        if (dentistId) {
            const dentist = await findActiveClinicDentist(dentistId, clinicId);
            if (!dentist) {
                return res.status(400).json({ error: 'Dentista inválido para esta clínica' });
            }
            validDentistId = dentist.id;
        }

```

E no `data` do `create`, trocar o último campo `structuredPlan` por:

```ts
                structuredPlan,
                dentistId: validDentistId
```

- [ ] **Step 5: planningController — update**

Em `updatePlanning`, trocar a desestruturação por:

```ts
        const { status, aiResponse, structuredPlan, dentistId } = req.body;
```

Após o bloco `if (!planning) { ... 404 ... }` e antes de `const updated = await prisma.planning.update({`, adicionar:

```ts
        let dentistData: { dentistId?: string | null } = {};
        if (dentistId === null || dentistId === '') {
            dentistData = { dentistId: null };
        } else if (dentistId !== undefined && dentistId !== planning.dentistId) {
            const dentist = await findActiveClinicDentist(dentistId, clinicId);
            if (!dentist) {
                return res.status(400).json({ error: 'Dentista inválido para esta clínica' });
            }
            dentistData = { dentistId: dentist.id };
        }

```

E no `data` do `update`, trocar o último campo `structuredPlan` por:

```ts
                structuredPlan,
                ...dentistData
```

- [ ] **Step 6: Verificar compilação**

Run (em `backend/`): `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/treatmentController.ts backend/src/controllers/planningController.ts
git commit -m "feat(dentistas): vincular dentista em planejamento e tratamento"
```

---

### Task 4: Serviço e `DentistSelect` no frontend

**Files:**
- Create: `apps/planner/src/services/dentistService.ts`
- Create: `apps/planner/src/components/DentistSelect.tsx`

**Interfaces:**
- Produces (`dentistService.ts`):
  ```ts
  export interface Dentist { id: string; clinicId: string; easyDentalId: string | null; name: string; cro: string; isActive: boolean; }
  export interface DentistInput { name: string; cro: string; easyDentalId?: string; isActive?: boolean; }
  export const dentistService: {
    list(includeInactive?: boolean): Promise<Dentist[]>;
    create(data: DentistInput): Promise<Dentist>;
    update(id: string, data: DentistInput): Promise<Dentist>;
    remove(id: string): Promise<{ deleted?: boolean; deactivated?: boolean }>;
  };
  ```
- Produces (`DentistSelect.tsx`):
  ```tsx
  export function DentistSelect(props: {
    value: string | null | undefined;          // dentistId atual ("" ou null = nenhum)
    onChange: (dentist: Dentist | null) => void; // null = "Nenhum"
    id?: string;
    fallbackLabel?: string;                    // rótulo quando o dentista vinculado não está na lista ativa
    disabled?: boolean;
  }): JSX.Element;
  ```

- [ ] **Step 1: Serviço**

Criar `apps/planner/src/services/dentistService.ts`:

```ts
import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface Dentist {
    id: string;
    clinicId: string;
    easyDentalId: string | null;
    name: string;
    cro: string;
    isActive: boolean;
}

export interface DentistInput {
    name: string;
    cro: string;
    easyDentalId?: string;
    isActive?: boolean;
}

const getAuthHeaders = () => {
    const token = getCookie('token');
    const selectedClinicId = localStorage.getItem('selectedClinicId');

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    if (selectedClinicId) {
        headers['x-clinic-id'] = selectedClinicId;
    }

    return headers;
};

const failure = async (response: Response, fallback: string): Promise<Error> => {
    try {
        const body = await response.json();
        return new Error(body.error || fallback);
    } catch {
        return new Error(fallback);
    }
};

export const dentistService = {
    async list(includeInactive = false): Promise<Dentist[]> {
        const response = await fetch(`${API_URL}/dentists${includeInactive ? '?includeInactive=true' : ''}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await failure(response, 'Erro ao buscar dentistas');
        return response.json();
    },

    async create(data: DentistInput): Promise<Dentist> {
        const response = await fetch(`${API_URL}/dentists`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw await failure(response, 'Erro ao criar dentista');
        return response.json();
    },

    async update(id: string, data: DentistInput): Promise<Dentist> {
        const response = await fetch(`${API_URL}/dentists/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw await failure(response, 'Erro ao atualizar dentista');
        return response.json();
    },

    async remove(id: string): Promise<{ deleted?: boolean; deactivated?: boolean }> {
        const response = await fetch(`${API_URL}/dentists/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await failure(response, 'Erro ao excluir dentista');
        return response.json();
    },
};
```

- [ ] **Step 2: Componente**

Criar `apps/planner/src/components/DentistSelect.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClinic } from "@/context/ClinicContext";
import { dentistService, Dentist } from "@/services/dentistService";

const NONE = "__none__";

interface DentistSelectProps {
    value: string | null | undefined;
    onChange: (dentist: Dentist | null) => void;
    id?: string;
    fallbackLabel?: string;
    disabled?: boolean;
}

export function DentistSelect({ value, onChange, id, fallbackLabel, disabled }: DentistSelectProps) {
    const { selectedClinicId } = useClinic();
    const [dentists, setDentists] = useState<Dentist[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        dentistService
            .list()
            .then((data) => { if (!cancelled) setDentists(data); })
            .catch(() => { if (!cancelled) setDentists([]); })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
    }, [selectedClinicId]);

    const isKnown = !value || dentists.some((d) => d.id === value);

    const handleChange = (next: string) => {
        if (next === NONE) return onChange(null);
        const dentist = dentists.find((d) => d.id === next);
        // Item de fallback (dentista inativo/fora da lista): manter a seleção atual.
        if (dentist) onChange(dentist);
    };

    return (
        <Select value={value || NONE} onValueChange={handleChange} disabled={disabled || isLoading}>
            <SelectTrigger id={id}>
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione o dentista"} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {value && !isKnown && (
                    <SelectItem value={value}>{fallbackLabel || "Dentista inativo"}</SelectItem>
                )}
                {dentists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                        {d.name} — CRO {d.cro}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
```

- [ ] **Step 3: Verificar tipos**

Run (em `apps/planner/`): `npx tsc -p tsconfig.app.json --noEmit`
Expected: sem erros novos nestes dois arquivos. (Se o projeto já tinha erros antes, comparar com `git stash` e registrar; não corrigir erros alheios.)

- [ ] **Step 4: Commit**

```bash
git add apps/planner/src/services/dentistService.ts apps/planner/src/components/DentistSelect.tsx
git commit -m "feat(dentistas): servico e componente DentistSelect"
```

---

### Task 5: Aba "Dentistas" em Minha Clínica

**Files:**
- Create: `apps/planner/src/components/DentistManager.tsx`
- Modify: `apps/planner/src/pages/ClinicSettings.tsx` (imports ~linha 15; JSX ~linhas 167-401)

**Interfaces:**
- Consumes: `dentistService`, `Dentist`, `DentistInput` de `@/services/dentistService`; `useHasPermission('manage', 'clinic')`.
- Produces: `export function DentistManager(props: { clinicId: string })` — lista (inclui inativos) + diálogo de cadastro/edição com 3 campos. Sem permissão `manage`/`clinic` a lista é somente leitura.

- [ ] **Step 1: Criar o componente**

Criar `apps/planner/src/components/DentistManager.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useHasPermission } from "@/hooks/useHasPermission";
import { dentistService, Dentist } from "@/services/dentistService";

const emptyForm = { easyDentalId: "", name: "", cro: "" };

export function DentistManager({ clinicId }: { clinicId: string }) {
    const canManage = useHasPermission("manage", "clinic");
    const [dentists, setDentists] = useState<Dentist[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Dentist | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [toDelete, setToDelete] = useState<Dentist | null>(null);

    const load = async () => {
        try {
            setIsLoading(true);
            setDentists(await dentistService.list(true));
        } catch (error: any) {
            toast.error(error.message || "Erro ao carregar dentistas");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [clinicId]);

    const openNew = () => {
        setEditing(null);
        setForm(emptyForm);
        setIsDialogOpen(true);
    };

    const openEdit = (dentist: Dentist) => {
        setEditing(dentist);
        setForm({ easyDentalId: dentist.easyDentalId || "", name: dentist.name, cro: dentist.cro });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.cro.trim()) {
            toast.error("Nome e CRO são obrigatórios");
            return;
        }
        setIsSaving(true);
        try {
            if (editing) {
                await dentistService.update(editing.id, { ...form, isActive: editing.isActive });
                toast.success("Dentista atualizado!");
            } else {
                await dentistService.create(form);
                toast.success("Dentista cadastrado!");
            }
            setIsDialogOpen(false);
            await load();
        } catch (error: any) {
            toast.error(error.message || "Erro ao salvar dentista");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (dentist: Dentist) => {
        try {
            await dentistService.update(dentist.id, {
                easyDentalId: dentist.easyDentalId || "",
                name: dentist.name,
                cro: dentist.cro,
                isActive: !dentist.isActive,
            });
            await load();
        } catch (error: any) {
            toast.error(error.message || "Erro ao atualizar dentista");
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            const result = await dentistService.remove(toDelete.id);
            toast.success(result.deactivated
                ? "Dentista possui registros vinculados e foi desativado."
                : "Dentista excluído!");
            setToDelete(null);
            await load();
        } catch (error: any) {
            toast.error(error.message || "Erro ao excluir dentista");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>Dentistas</CardTitle>
                    <CardDescription>
                        Dentistas da clínica, usados para preencher o CRO em planejamentos, tratamentos e termos
                    </CardDescription>
                </div>
                {canManage && (
                    <Button type="button" onClick={openNew}>
                        <Plus className="mr-2 h-4 w-4" /> Novo dentista
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : dentists.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Nenhum dentista cadastrado.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>CRO</TableHead>
                                <TableHead>ID EasyDental</TableHead>
                                <TableHead>Status</TableHead>
                                {canManage && <TableHead className="text-right">Ações</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dentists.map((d) => (
                                <TableRow key={d.id}>
                                    <TableCell className="font-medium">{d.name}</TableCell>
                                    <TableCell>{d.cro}</TableCell>
                                    <TableCell>{d.easyDentalId || "-"}</TableCell>
                                    <TableCell>
                                        <Badge variant={d.isActive ? "default" : "secondary"}>
                                            {d.isActive ? "Ativo" : "Inativo"}
                                        </Badge>
                                    </TableCell>
                                    {canManage && (
                                        <TableCell className="text-right space-x-1">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(d)} aria-label="Editar">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" onClick={() => handleToggleActive(d)}>
                                                {d.isActive ? "Desativar" : "Ativar"}
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setToDelete(d)} aria-label="Excluir">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar dentista" : "Novo dentista"}</DialogTitle>
                        <DialogDescription>Informe o nome e o CRO. O ID do EasyDental é opcional.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="dentistName">Nome *</Label>
                            <Input id="dentistName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dentistCro">CRO *</Label>
                            <Input id="dentistCro" placeholder="Ex: SP-12345" value={form.cro} onChange={(e) => setForm({ ...form, cro: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dentistEasyId">ID do EasyDental</Label>
                            <Input id="dentistEasyId" value={form.easyDentalId} onChange={(e) => setForm({ ...form, easyDentalId: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button type="button" onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir dentista?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {toDelete?.name} será excluído. Se houver planejamentos ou tratamentos vinculados, ele será apenas desativado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
```

- [ ] **Step 2: Imports em ClinicSettings**

Em `apps/planner/src/pages/ClinicSettings.tsx`, após `import { Separator } from "@/components/ui/separator";`, adicionar:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DentistManager } from "@/components/DentistManager";
```

- [ ] **Step 3: Abas**

Trocar a linha de abertura `                    <Form {...form}>` por:

```tsx
                    <Tabs defaultValue="dados" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="dados">Dados da Clínica</TabsTrigger>
                            <TabsTrigger value="dentistas">Dentistas</TabsTrigger>
                        </TabsList>
                        <TabsContent value="dados">
                    <Form {...form}>
```

E trocar o fechamento `                    </Form>` (seguido de `                </div>` e `            </main>`) por:

```tsx
                    </Form>
                        </TabsContent>
                        <TabsContent value="dentistas">
                            <DentistManager clinicId={currentClinic.id} />
                        </TabsContent>
                    </Tabs>
```

(O conteúdo interno do `<Form>` não é reindentado, para manter o diff mínimo.)

- [ ] **Step 4: Verificar tipos e build**

Run (em `apps/planner/`): `npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: sem erros novos; build do Vite conclui.

- [ ] **Step 5: Commit**

```bash
git add apps/planner/src/components/DentistManager.tsx apps/planner/src/pages/ClinicSettings.tsx
git commit -m "feat(dentistas): aba Dentistas em Minha Clinica"
```

---

### Task 6: Usar o dentista em planejamento, tratamento, termo e dashboard

**Files:**
- Modify: `apps/planner/src/services/patientService.ts` (tipos, linhas ~73-87, 254, 268, 383, 411)
- Modify: `apps/planner/src/pages/NovoPlanejamentoIA.tsx`
- Modify: `apps/planner/src/pages/Tratamento.tsx`
- Modify: `apps/planner/src/pages/TermoDeCompromisso.tsx`
- Modify: `apps/planner/src/pages/Dashboard.tsx` (linha ~220)

**Interfaces:**
- Consumes: `DentistSelect`, `Dentist` (Task 4); API `dentistId` (Task 3).
- Produces: `Treatment.dentistId?: string | null`, `Treatment.dentistCro?: string | null`; `createTreatment`/`updateTreatment` aceitam `dentistId?: string | null` e `doctorName?: string | null`; `createPlanning`/`updatePlanning` aceitam `dentistId?: string | null`.

- [ ] **Step 1: Tipos em patientService**

Em `interface Treatment`, após `doctorName?: string;`, adicionar:

```ts
dentistId?: string | null;
dentistCro?: string | null;
```

Na assinatura de `createPlanning` (linha ~254), trocar `structuredPlan?: any }` por `structuredPlan?: any; dentistId?: string | null }`.
Na assinatura de `updatePlanning` (linha ~268), trocar `structuredPlan?: any }` por `structuredPlan?: any; dentistId?: string | null }`.
Nas assinaturas de `createTreatment` (~383) e `updateTreatment` (~411), trocar `doctorName?: string }` por `doctorName?: string | null; dentistId?: string | null }`.

- [ ] **Step 2: NovoPlanejamentoIA — imports e estado**

Após `import { PatientSelector } from "@/components/PatientSelector";` adicionar:

```tsx
import { DentistSelect } from "@/components/DentistSelect";
import type { Dentist } from "@/services/dentistService";
```

Em `initialFormData`, após `croOrtodontista: "",` adicionar:

```tsx
  dentistId: "",
```

Após a função `handleSelectPatient` (termina ~linha 148), adicionar:

```tsx
  const handleSelectDentist = (dentist: Dentist | null) => {
    setFormData(prev => dentist
      ? { ...prev, dentistId: dentist.id, nomeOrtodontista: dentist.name, croOrtodontista: dentist.cro }
      : { ...prev, dentistId: "" });
  };
```

- [ ] **Step 3: NovoPlanejamentoIA — card "Responsável Técnico"**

Substituir o `CardContent` do card "Responsável Técnico" (linhas ~1093-1097) por:

```tsx
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2"><Label htmlFor="dentistId">Ortodontista cadastrado</Label><DentistSelect id="dentistId" value={formData.dentistId} onChange={handleSelectDentist} fallbackLabel={formData.nomeOrtodontista} /></div>
                <div className="space-y-2"><Label htmlFor="nomeOrtodontista">Nome do ortodontista *</Label><Input id="nomeOrtodontista" required readOnly={!!formData.dentistId} value={formData.nomeOrtodontista} onChange={(e) => setFormData({ ...formData, nomeOrtodontista: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="croOrtodontista">CRO do ortodontista *</Label><Input id="croOrtodontista" required readOnly={!!formData.dentistId} value={formData.croOrtodontista} onChange={(e) => setFormData({ ...formData, croOrtodontista: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="dataPlanejamento">Data *</Label><Input id="dataPlanejamento" type="date" required value={formData.dataPlanejamento} onChange={(e) => setFormData({ ...formData, dataPlanejamento: e.target.value })} /></div>
              </CardContent>
```

(Sem dentista selecionado, nome e CRO continuam editáveis, para clínicas sem cadastro.)

- [ ] **Step 4: NovoPlanejamentoIA — enviar `dentistId`**

No `updatePlanning` (~linha 578), após `structuredPlan: { ...formData, patientId: patientResult.patient.id },` adicionar a linha:

```tsx
          dentistId: formData.dentistId || null,
```

No `createPlanning` (~linha 584), mesma coisa, após a linha `structuredPlan: { ...formData, patientId: patientResult.patient.id },`:

```tsx
          dentistId: formData.dentistId || null,
```

- [ ] **Step 5: Tratamento**

Em `apps/planner/src/pages/Tratamento.tsx`:

1. Após `import Sidebar from "@/components/Sidebar";` adicionar:
   ```tsx
   import { DentistSelect } from "@/components/DentistSelect";
   import type { Dentist } from "@/services/dentistService";
   ```
2. Após `const [doctorName, setDoctorName] = useState("");` adicionar:
   ```tsx
   const [dentistId, setDentistId] = useState("");
   ```
3. Nos dois blocos de `loadTreatment`, após cada `setDoctorName(treatment.doctorName || "");` adicionar:
   ```tsx
   setDentistId(treatment.dentistId || "");
   ```
4. Antes de `const handleSave`, adicionar:
   ```tsx
   const handleSelectDentist = (dentist: Dentist | null) => {
   setDentistId(dentist?.id ?? "");
   setDoctorName(dentist?.name ?? "");
   };
   ```
5. Em `handleSave`, trocar `doctorName: doctorName || undefined,` por:
   ```tsx
   doctorName: doctorName || null,
   dentistId: dentistId || null,
   ```
6. Substituir o bloco `{/* Dentista */}` (o `div` com `Label htmlFor="doctorName"` e o `Input`) por:
   ```tsx
   {/* Dentista */}
   <div className="space-y-2">
   <Label htmlFor="dentistId" className="flex items-center gap-1">
   <User className="h-4 w-4 text-teal-500" />
   Dentista Responsável
   </Label>
   <DentistSelect id="dentistId" value={dentistId} onChange={handleSelectDentist} fallbackLabel={doctorName} />
   {!dentistId && doctorName && (
   <p className="text-sm text-muted-foreground">Dentista atual (texto livre): {doctorName}</p>
   )}
   </div>
   ```

- [ ] **Step 6: TermoDeCompromisso**

Em `apps/planner/src/pages/TermoDeCompromisso.tsx`:

1. Após `import { useClinic } from "@/context/ClinicContext";` adicionar:
   ```tsx
   import { DentistSelect } from "@/components/DentistSelect";
   import type { Dentist } from "@/services/dentistService";
   ```
2. Após `const [logoFile, setLogoFile] = useState<File | null>(null);` adicionar:
   ```tsx
       const [dentistId, setDentistId] = useState("");
   ```
3. No efeito de auto-preenchimento, dentro de `if (parsed) {`, antes do `setContractData(prev => ({` adicionar:
   ```tsx
           setDentistId(parsed.dentistId || "");
   ```
4. Antes de `const handleInputChange`, adicionar:
   ```tsx
       const handleSelectDentist = (dentist: Dentist | null) => {
           setDentistId(dentist?.id ?? "");
           if (dentist) {
               setContractData(prev => ({ ...prev, nomeDentista: dentist.name, croDentista: dentist.cro }));
           }
       };
   ```
5. Imediatamente antes do `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">` que contém `nomeDentista` (~linha 804), inserir:
   ```tsx
                                   <div className="space-y-2">
                                       <Label htmlFor="dentistId">Dentista cadastrado</Label>
                                       <DentistSelect id="dentistId" value={dentistId} onChange={handleSelectDentist} fallbackLabel={contractData.nomeDentista} />
                                   </div>
   ```

(`nomeDentista` e `croDentista` continuam editáveis; o select só os preenche.)

- [ ] **Step 7: Dashboard**

Em `apps/planner/src/pages/Dashboard.tsx` (~linha 220), trocar:

```tsx
{t.planning?.patient?.user?.name || t.patient?.user?.name || t.doctorName || '-'}
```

por:

```tsx
{t.doctorName || t.planning?.patient?.user?.name || t.patient?.user?.name || '-'}
```

- [ ] **Step 8: Verificar tipos e build**

Run (em `apps/planner/`): `npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: sem erros novos; build conclui.

- [ ] **Step 9: Commit**

```bash
git add apps/planner/src
git commit -m "feat(dentistas): selecionar dentista em planejamento, tratamento e termo"
```

---

### Task 7: Deploy no host remoto e teste manual

**Pré-requisito:** todas as tarefas anteriores commitadas, `npm test` (backend) e `npm run build` (planner) passando. **Pare e peça confirmação ao usuário antes de cada passo marcado (CONFIRMAR).**

**Files:** nenhum arquivo do repositório muda (exceto se o teste revelar bugs).

- [ ] **Step 1: (CONFIRMAR) Enviar o código ao git**

O host vai clonar de `origin` (`https://github.com/marqprochat/ortho-ai-planner.git`). Perguntar ao usuário se pode fazer `git push origin main` (ou em qual branch). Só então:

```bash
git push origin main
```

- [ ] **Step 2: (CONFIRMAR) Acesso SSH sem senha**

Peça ao usuário para autorizar uma chave: ele mesmo roda, no terminal dele (a senha é digitada por ele, nunca por mim):

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_ed25519_casaos -N '""'
type $env:USERPROFILE\.ssh\id_ed25519_casaos.pub | ssh edmar@192.168.15.7 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Verificar: `ssh -i $env:USERPROFILE\.ssh\id_ed25519_casaos -o BatchMode=yes edmar@192.168.15.7 "docker --version && git --version"`
Expected: versões do docker e do git. Se faltar `git`, parar e avisar o usuário.

- [ ] **Step 3: (CONFIRMAR) Primeiro deploy no host**

```bash
ssh -i ~/.ssh/id_ed25519_casaos edmar@192.168.15.7 "git clone https://github.com/marqprochat/ortho-ai-planner.git ~/ortho-ai-planner || (cd ~/ortho-ai-planner && git pull)"
ssh -i ~/.ssh/id_ed25519_casaos edmar@192.168.15.7 "cd ~/ortho-ai-planner && docker compose up -d --build database backend planner"
```

(`VITE_API_URL` fica vazio: o planner usa `/api` e o nginx do container repassa ao backend. Os segredos padrão do `docker-compose.yml` bastam para o teste.)
Expected: `docker compose ps` mostra `database` (healthy), `backend` e `planner` em `running`.

- [ ] **Step 4: Confirmar que a migration foi aplicada**

```bash
ssh -i ~/.ssh/id_ed25519_casaos edmar@192.168.15.7 "cd ~/ortho-ai-planner && docker compose logs backend | grep -E 'Migrations applied|add_dentists|Migration failed'"
ssh -i ~/.ssh/id_ed25519_casaos edmar@192.168.15.7 "cd ~/ortho-ai-planner && docker compose exec -T database psql -U ortho -d portalclinicas -c '\d \"Dentist\"'"
```

Expected: `✅ Migrations applied successfully.` e a tabela `Dentist` com as colunas e o índice `Dentist_clinicId_cro_key`. Se `Migration failed`, parar e investigar (`systematic-debugging`) antes de continuar.

- [ ] **Step 5: Smoke test da API (curl, rodando no host)**

Banco novo: o primeiro usuário registrado vira SuperAdmin. Sequência (substituir `$T` e `$C` pelos valores devolvidos):

```bash
B=http://localhost:5174
curl -s -X POST $B/api/auth/register -H 'Content-Type: application/json' -d '{"email":"teste@dentistas.local","password":"Teste12345","name":"Admin Teste"}'
# guardar o token como $T
curl -s -X POST $B/api/clinics -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"Clínica Teste"}'
# guardar o id como $C
curl -s -X POST $B/api/dentists -H "Authorization: Bearer $T" -H "x-clinic-id: $C" -H 'Content-Type: application/json' -d '{"name":"Ana Souza","cro":"sp 123","easyDentalId":"77"}'
```

Expected, em ordem:
1. Criar dentista → `201`, `cro` = `"SP 123"`.
2. Repetir o mesmo POST → `409` `Já existe um dentista com este CRO nesta clínica`.
3. POST sem nome → `400` `Nome é obrigatório`.
4. `GET /api/dentists` com `x-clinic-id: $C` → lista com 1 item; sem o header → `400` `Clínica não selecionada ou inválida`.
5. `GET /api/dentists` com `x-clinic-id` de outra clínica criada depois → lista vazia (isolamento).
6. `DELETE /api/dentists/<id>` sem vínculos → `{"deleted":true}`.

- [ ] **Step 6: Teste manual na interface**

Abrir `http://192.168.15.7:5172`, entrar com o usuário do passo 5 e conferir:
1. Minha Clínica → aba **Dentistas** → cadastrar "Ana Souza", CRO "SP-123", ID EasyDental "77"; aparece na lista; editar; desativar/ativar.
2. Novo Planejamento → selecionar o dentista em "Ortodontista cadastrado": nome e CRO preenchem sozinhos e ficam travados; "Nenhum" destrava. Salvar documentação com um paciente.
3. Tratamento do paciente → escolher o dentista; salvar; reabrir e conferir que o select mantém a escolha. Relatório de tratamentos mostra o nome na coluna "Dentista".
4. Termo de Compromisso → "Dentista cadastrado" preenche nome e CRO; o PDF mostra o CRO correto.
5. Excluir um dentista que já tem tratamento → toast "foi desativado" e o select não o oferece mais, mas o tratamento antigo continua exibindo o nome.

- [ ] **Step 7: Registrar o resultado**

Se tudo passou, informar ao usuário o resultado de cada item (passou/falhou, com evidência). Se algo falhou, corrigir com um commit novo e repetir os passos 3-6 com `git pull` + `docker compose up -d --build` no host (CONFIRMAR o push).
