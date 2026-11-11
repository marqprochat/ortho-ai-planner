# Ortho AI Planner — Servidor MCP

Servidor MCP (`stdio`) para consultar e alterar dados do **Ortho AI Planner** a partir de clientes como **Claude Desktop**, **Gemini CLI**, **Antigravity** e **Cursor**, incluindo ferramentas específicas para **padronização de dentistas** em tratamentos, planejamentos e contratos.

## Instalação e Build

```bash
cd mcp-server
npm install
npm run prisma:generate
npm run build
```

Por padrão, o servidor usa a variável `DATABASE_URL` do ambiente; se ela não estiver definida, ele carrega automaticamente `../backend/.env`.

## Configuração nos Clientes de IA

Substitua `DATABASE_URL` se quiser apontar para outro banco (opcional se `backend/.env` já estiver configurado localmente):

```json
{
  "mcpServers": {
    "ortho-ai-planner": {
      "command": "node",
      "args": ["P:/APPS/ortho-ai-planner/mcp-server/dist/mcp-server/src/index.js"],
      "env": {
        "MCP_ACTOR_NAME": "Claude/Gemini MCP"
      }
    }
  }
}
```

- **Claude Desktop** (Windows): `%APPDATA%\Claude\claude_desktop_config.json`
- **Gemini CLI**: `~/.gemini/settings.json`
- **Antigravity / Cursor**: arquivo `mcp_config.json` / `.cursor/mcp.json`

## Ferramentas Disponíveis

- **Clínicas**: `list_clinics`, `get_clinic`, `update_clinic`
- **Dentistas & Padronização**: `list_dentists`, `create_dentist`, `update_dentist`, `delete_dentist`, `list_unlinked_dentist_names`, `preview_dentist_standardization`, `apply_dentist_standardization`
- **Pacientes**: `list_patients`, `get_patient`, `create_patient`, `update_patient`, `transfer_patient`, `delete_patient`
- **Planejamentos**: `list_plannings`, `get_planning`, `create_planning`, `update_planning`, `delete_planning`
- **Tratamentos**: `list_treatments`, `get_treatment`, `create_treatment`, `update_treatment`, `delete_treatment`
- **Contratos**: `list_contracts`, `get_contract`, `create_contract`, `update_contract`, `sign_contract`, `delete_contract`
- **Relatórios & Auditoria**: `get_planner_summary`, `list_users`, `list_audit_logs`

