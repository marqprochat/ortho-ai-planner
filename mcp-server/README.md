# Ortho AI Planner — Servidor MCP

Servidor MCP para consultar e alterar dados do **Ortho AI Planner** a partir de clientes como **Claude**, **Cursor**, **Gemini**, **Antigravity**, **LibreChat** e **Open WebUI**, incluindo ferramentas específicas para **padronização de dentistas** em tratamentos, planejamentos e contratos.

Suporta **dois modos**:
1. **Conexão por Link (SSE / HTTP)** — Para conectar de qualquer lugar apenas colando a URL no cliente de IA.
2. **Conexão Local (`stdio`)** — Para rodar via linha de comando local.

---

## 1. Conectar por Link (SSE / HTTP) — Recomendado

Quando o servidor estiver rodando no Docker ou na sua VPS, basta usar o link:

```
http://SEU_IP_DO_SERVIDOR:5176/sse
```
Ou com domínio / HTTPS:
```
https://mcp.seudominio.com/sse
```

### Com Chave de Segurança (Opcional)
Se você configurou `MCP_API_KEY=sua_chave_secreta` no `.env`, conecte passando o link com o token:
```
https://mcp.seudominio.com/sse?apiKey=sua_chave_secreta
```

### Como configurar nos clientes:

* **Cursor**:
  Vá em **Settings** > **Features** > **MCP Servers** > **Add New MCP Server**:
  * **Name:** `ortho-planner`
  * **Type:** `sse`
  * **URL:** `https://mcp.seudominio.com/sse?apiKey=sua_chave_secreta`

* **Claude Desktop**:
  ```json
  {
    "mcpServers": {
      "ortho-ai-planner": {
        "url": "https://mcp.seudominio.com/sse?apiKey=sua_chave_secreta"
      }
    }
  }
  ```

---

## 2. Conectar Localmente (`stdio`)

Para rodar via processo local:

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

---

## Como Rodar no Servidor (Docker Compose)

No servidor, o serviço `mcp` já faz parte do `docker-compose.yml`:

```bash
docker compose up -d --build mcp
```
Ele subirá na porta `5176` (mapeada para `3001` internamente).

---

## Ferramentas Disponíveis (35 tools)

- **Clínicas**: `list_clinics`, `get_clinic`, `update_clinic`
- **Dentistas & Padronização**: `list_dentists`, `create_dentist`, `update_dentist`, `delete_dentist`, `list_unlinked_dentist_names`, `preview_dentist_standardization`, `apply_dentist_standardization`
- **Pacientes**: `list_patients`, `get_patient`, `create_patient`, `update_patient`, `transfer_patient`, `delete_patient`
- **Planejamentos**: `list_plannings`, `get_planning`, `create_planning`, `update_planning`, `delete_planning`
- **Tratamentos**: `list_treatments`, `get_treatment`, `create_treatment`, `update_treatment`, `delete_treatment`
- **Contratos**: `list_contracts`, `get_contract`, `create_contract`, `update_contract`, `sign_contract`, `delete_contract`
- **Relatórios & Auditoria**: `get_planner_summary`, `list_users`, `list_audit_logs`
