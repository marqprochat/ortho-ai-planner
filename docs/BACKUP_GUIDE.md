# 💾 Guia de Backups Automáticos — Ortho AI Planner

Este guia orienta como configurar a rotina automática de backup e restauração do banco PostgreSQL.

---

## 1. Estrutura dos Scripts

- `scripts/backup.sh`: Executa o dump compactado (`.sql.gz`) do container PostgreSQL, salva na pasta `backups/` e aplica retenção (padrão: 14 dias).
- `scripts/restore.sh`: Restaura o banco de dados a partir de um arquivo `.sql.gz`.

---

## 2. Permissões de Execução

No terminal do servidor, conceda permissão de execução aos scripts:

```bash
chmod +x scripts/backup.sh scripts/restore.sh
```

---

## 3. Configuração de Agendamento Automático

### Opção A: Via aaPanel (Recomendado se usar aaPanel)
1. Acesse o painel do **aaPanel**.
2. Vá em **Cron** no menu lateral.
3. Preencha os campos:
   - **Type of Task:** Shell Script
   - **Name of Task:** Backup Ortho AI Planner
   - **Period:** Daily (exemplo: `03:00` da manhã)
   - **Script Content:**
     ```bash
     /bin/bash /www/wwwroot/ortho-ai-planner/scripts/backup.sh >> /var/log/ortho-backup.log 2>&1
     ```
4. Clique em **Add Task**.

### Opção B: Via Crontab do Linux (VPS / Ubuntu / Debian)
Edite a crontab do servidor:

```bash
crontab -e
```

Adicione a linha para rodar todos os dias às 03:00:

```cron
0 3 * * * /bin/bash /caminho/do/projeto/scripts/backup.sh >> /var/log/ortho-backup.log 2>&1
```

---

## 4. Variáveis de Ambiente Opcionais (no `.env`)

```env
# Dias para manter os backups antes de expurgar (padrão: 14)
BACKUP_RETENTION_DAYS=14

# Diretório customizado de backups (opcional)
BACKUP_DIR=/var/backups/ortho
```

---

## 5. Como Restaurar um Backup

Para restaurar um backup específico em caso de necessidade:

```bash
./scripts/restore.sh ./backups/ortho_portalclinicas_2026-10-28_030000.sql.gz
```
