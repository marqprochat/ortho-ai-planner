# Relatórios Dashboard - Plano de Implementação

## Overview
Implementar um sistema de relatórios ("Drill-down") no dashboard existente. Ao clicar nos cards do dashboard, o usuário será levado a tabelas detalhadas com filtros avançados e botões de exportação (PDF/CSV). Será adicionado um novo sistema de permissões gerido pelo super admin para definir quem e quais relatórios podem ser visualizados. Não vamos pré-agregar dados neste primeiro momento visando relatórios recentes em tempo real.

## Project Type
WEB + BACKEND

## Success Criteria
- [ ] Ao clicar nos cards do dashboard, uma tabela detalhada é carregada, refletindo o contexto do card original.
- [ ] A tabela inclui barra de pesquisa, botões para filtros temporais e demais filtros do negócio (sem problemas de data baseados no feedback do cliente).
- [ ] Botão de exportação extrai as informações da tabela perfeitamente em CSV e PDF.
- [ ] Controle de acesso configurado no backend e frontend garantindo que usuários possuam permissões atreladas ao seu perfil ou atribuídas manualmente via Super Admin.
- [ ] Novo item / submenu de Relatórios adicionados na interface (Sidebar e navegação global).

## Tech Stack
- **Frontend**: Vite + React, Shadcn UI para tabelas (Data Table e Cards), `jspdf` para exportação, Tailwind CSS.
- **Backend/API**: NestJS/Express (Padrões estabelecidos na pasta `/backend`), PostgreSQL via Prisma (Padrões estabelecidos nos profiles).

## Principais Arquivos Afetados
- **Backend:** Models/Entities de Perfil/User (para as novas permissões).
- **Frontend:** 
  - `apps/planner/src/pages/Dashboard.tsx` (Tornar cards interativos).
  - `apps/planner/src/pages/Reports/*.tsx` ou novo módulo `apps/planner/src/features/reports/*` [NOVOS].
  - `apps/planner/src/components/Sidebar.tsx` ou afim (adicionar de menus).

## Task Breakdown
1. **[Backend] Modelar Permissões e Roles do Relatório (Database & API)**
   - `Agent`: `database-architect` / `backend-specialist`
   - `Skill`: `database-design`, `api-patterns`
   - `INPUT`: Estrutura do DB de Usuários existente.
   - `OUTPUT`: Tabela ou flag indicando Permissões granulares de relatórios por ID, com CRUD exclusivo pro Super Admin atrelar um usuário a X relatórios.
   - `VERIFY`: Testar API de restrição (ex: GET no endpoint de relatórios deve retonar 403 Forbidden se o usuário não logado sem as roles).

2. **[Backend] Criar Endpoints com Queries Complexas/Filtros (Drill-down)**
   - `Agent`: `backend-specialist`
   - `Skill`: `api-patterns`
   - `INPUT`: Dados que formam os Cards iniciais do Dashboard.
   - `OUTPUT`: Endpoints parametrizados que esperam _query strings_ de filtro e paginação para retornar Arrays completos e não agregados.
   - `VERIFY`: Checar a latência da query para intervalos amplos via banco e validar retorno paginado.

3. **[Frontend] Interface do Super Admin: Gestão de Acessos de Relatórios**
   - `Agent`: `frontend-specialist`
   - `Skill`: `frontend-design`
   - `INPUT`: Novo CRUD de Permissões da API Backend.
   - `OUTPUT`: Uma sub-aba ou modal no Perfil do Usuário para o gestor ticar quais relatórios ele tem acesso.
   - `VERIFY`: Realizar alteração em um usuário secundário e checar visualmente se ele ganha/perde acesso no sidebar do menu.

4. **[Frontend] Atualizar Cards do Dashboard e Criar Submenus**
   - `Agent`: `frontend-specialist`
   - `Skill`: `frontend-design`
   - `INPUT`: Dashboard e Permissões do usuário em sessão.
   - `OUTPUT`: Refatorar cards para terem comportamentos `<Link>` contendo os parâmetros iniciais em query. Implementar item Sidebar.
   - `VERIFY`: O item só aparece se o usuário possui acesso aos relatórios. O drill-down roteia corretamente.

5. **[Frontend] Implementar Telas de Tabela Detalhada com Filtros**
   - `Agent`: `frontend-specialist`
   - `Skill`: `frontend-design`
   - `INPUT`: Endpoints de Relatórios do Backend.
   - `OUTPUT`: Tela usando shadcn/`data-table` paginada; Filtros variados (Status, Tipo, etc).
   - `VERIFY`: Filtros atualizam localmente o estado e injetam `?params` na fetch refetchando a query.

6. **[Frontend] Implementar Exportação de Relatórios (CSV/PDF) na Data Table**
   - `Agent`: `frontend-specialist`
   - `Skill`: `frontend-design`
   - `INPUT`: Dados atuais na Tela (Tabela Detalhada).
   - `OUTPUT`: Ações no header da página que compilam a grid visível num relatório customizável PDF ou CSV.
   - `VERIFY`: O layout do PDF é elegante e quebra em páginas conforme volume, e o CSV pode ser aberto excel corretamente.

---

## ✅ PHASE X COMPLETE
- Lint: [ ] Pass
- Security: [ ] No critical issues
- Build: [ ] Success
- Date: [Pendendo Implementação]
