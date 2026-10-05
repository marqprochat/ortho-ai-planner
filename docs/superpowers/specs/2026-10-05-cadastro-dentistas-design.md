# Cadastro de Dentistas por Clínica — Design

Data: 2026-10-05

## Objetivo

Padronizar o dentista responsável em planejamentos, tratamentos e termos. Cada clínica mantém uma lista de dentistas (ID EasyDental, Nome, CRO). Ao criar planejamento ou tratamento, o usuário seleciona o dentista e o CRO é preenchido automaticamente.

## Decisões

- Escopo: por clínica (`clinicId`).
- Cadastro: nova aba "Dentistas" em `ClinicSettings`.
- Vínculo: `Planning` e `Treatment` referenciam `Dentist` por FK opcional. Nome e CRO continuam gravados como cópia no registro, para que documentos antigos não mudem se o cadastro for editado.
- Ambiente de teste: host remoto 192.168.15.7 (CasaOS), com deploy via git. Nenhum docker nesta máquina. Push e deploy só com confirmação do usuário.

## Dados (Prisma)

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

- `Planning.dentistId String?` com `onDelete: SetNull`. A cópia de nome e CRO do planejamento já existe em `structuredPlan` (`nomeOrtodontista`, `croOrtodontista`), então não há colunas novas de nome/CRO em `Planning`.
- `Treatment.dentistId String?` com `onDelete: SetNull`; `Treatment.doctorName` permanece como cópia; adicionar `Treatment.dentistCro String?`.
- Migration apenas aditiva (campos novos opcionais).

## Backend

Rotas autenticadas, filtradas pela clínica atual e pelo tenant, seguindo o padrão dos controllers existentes:

- `GET /dentists` (query `includeInactive` opcional)
- `POST /dentists` (valida nome e CRO obrigatórios; CRO único na clínica)
- `PUT /dentists/:id`
- `DELETE /dentists/:id` — remove se não houver vínculos; caso contrário, apenas desativa (`isActive=false`).

Criação/edição de `Planning` e `Treatment` aceita `dentistId`; o backend valida que o dentista pertence à clínica do paciente e grava a cópia de nome/CRO.

## Frontend (apps/planner)

- `ClinicSettings.tsx`: aba "Dentistas" com lista e formulário (ID EasyDental, Nome, CRO).
- Componente `DentistSelect` reutilizável (dentistas ativos da clínica atual).
- Uso em: `NovoPlanejamentoIA.tsx` (preenche `croOrtodontista`), `Tratamento.tsx` (substitui o campo de texto), `TermoDeCompromisso.tsx` (nome e CRO), relatórios e Dashboard (exibem dentista pelo vínculo, com fallback para `doctorName`).

## Dados antigos

Tratamentos com `doctorName` em texto continuam exibidos como estão, sem vínculo, até o usuário escolher um dentista.

## Testes

- API: CRUD, isolamento por clínica, unicidade de CRO, DELETE com e sem vínculos.
- Manual no ambiente remoto após deploy: cadastrar dentista, criar planejamento e tratamento com o select, conferir CRO automático, termo e relatório.
