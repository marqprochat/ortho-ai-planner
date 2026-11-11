# Plano de Implementação: Backups Automáticos e Logs de Auditoria

## Contexto & Objetivos
- **Alvo:** Sistema Ortho AI Planner (v2.4.0)
- **Escopo Concluído:**
  1. **Backups Automáticos (P0):** Rotina local no host via script shell e container Docker com compressão `pg_dump`, nomenclatura com timestamp e política de retenção automática (expurgo de backups com mais de 14 dias).
  2. **Logs de Acesso e Auditoria (P1):** Tabela `AuditLog` no PostgreSQL (Prisma), serviço de gravação assíncrono para eventos críticos (login, falha de login, criação, edição, deleção e visualização de pacientes/prontuários/transferências) e endpoints com filtros e métricas.
  3. **Interface no Portal Administrativo (P2):** Tela moderna de visualização, busca textual, filtros múltiplos (por data, usuário, ação e recurso), modal de inspeção com payload JSON e exportação direta para planilha CSV no app `portal`.

---

## Estrutura de Arquivos Criados / Modificados

### Novos Arquivos
- ✅ `scripts/backup.sh` — Script shell de backup automatizado para PostgreSQL no Docker com gzip e retenção
- ✅ `scripts/restore.sh` — Script interativo para restauração assistida de backups
- ✅ `docs/BACKUP_GUIDE.md` — Guia completo de agendamento via Cron (aaPanel / Linux / VPS)
- ✅ `backend/prisma/migrations/20261028150000_add_audit_log/migration.sql` — Migration SQL com índices de alta performance
- ✅ `backend/src/services/auditService.ts` — Serviço desacoplado e assíncrono de persistência de logs
- ✅ `backend/src/controllers/auditLogController.ts` — Controller com listagem paginada, estatísticas 24h e filtros
- ✅ `apps/portal/src/services/auditService.ts` — Serviço frontend para consumo da API de auditoria
- ✅ `apps/portal/src/pages/admin/AuditLogManagement.tsx` — Interface visual administrativa completa

### Arquivos Modificados
- ✅ `backend/prisma/schema.prisma` — Adicionado model `AuditLog` com índices otimizados
- ✅ `backend/src/index.ts` — Registradas rotas `/api/admin/audit-logs` e `/api/admin/audit-logs/stats`
- ✅ `backend/src/controllers/authController.ts` — Registro de auditoria em login e login com falha
- ✅ `backend/src/controllers/patientController.ts` — Registro de auditoria em criação, leitura, edição, exclusão e transferência de pacientes
- ✅ `apps/portal/src/App.tsx` — Adicionada rota protegida `/admin/audit-logs`
- ✅ `apps/portal/src/pages/DashboardPage.tsx` — Adicionado card "Logs e Auditoria" no gerenciamento administrativo

---

## Status das Tarefas de Execução

- [x] **Fase 1: Automação de Backups Locais**
  - [x] Criar `scripts/backup.sh` com `pg_dump`, gzip, timestamp e retenção (14 dias)
  - [x] Criar `scripts/restore.sh` para recuperação rápida
  - [x] Documentar agendamento via Cron (`docs/BACKUP_GUIDE.md`)

- [x] **Fase 2: Schema de Banco de Dados & Serviço de Auditoria**
  - [x] Adicionar model `AuditLog` no `schema.prisma`
  - [x] Gerar migration `20261028150000_add_audit_log`
  - [x] Executar `npx prisma generate` do Prisma Client
  - [x] Implementar `backend/src/services/auditService.ts`

- [x] **Fase 3: Backend API & Rastreabilidade de Operações**
  - [x] Criar `auditLogController.ts` (listagem, filtros, estatísticas 24h)
  - [x] Integrar chamadas de auditoria nos controllers (Auth, Pacientes)
  - [x] Registrar rotas no `backend/src/index.ts` protegidas por `authMiddleware` e `requireSuperAdmin`

- [x] **Fase 4: Interface Visual no Portal Admin**
  - [x] Implementar `apps/portal/src/services/auditService.ts`
  - [x] Criar página `apps/portal/src/pages/admin/AuditLogManagement.tsx` com busca, filtros, inspeção de modal e exportação CSV
  - [x] Adicionar rota em `apps/portal/src/App.tsx` e card na `DashboardPage.tsx`

- [x] **Fase 5: Verificação e Validação**
  - [x] Compilação TypeScript do backend (`npm run build` aprovado com 0 erros)
  - [x] Compilação/build do portal (`npm run build` aprovado com 0 erros)
  - [x] Validação sintática e permissões dos scripts de backup e restauração
