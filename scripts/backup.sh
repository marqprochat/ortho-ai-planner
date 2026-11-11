#!/usr/bin/env bash
# ==============================================================================
# Ortho AI Planner - Script de Backup Automático do PostgreSQL
# ==============================================================================
# Utilização:
#   chmod +x backup.sh
#   ./backup.sh
#
# Agendamento no Cron (exemplo: todo dia às 03:00):
#   0 3 * * * /caminho/para/scripts/backup.sh >> /var/log/ortho-backup.log 2>&1
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Carregar variáveis do .env caso exista
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

DB_USER="${DB_USER:-ortho}"
DB_NAME="${DB_NAME:-portalclinicas}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# Diretório de armazenamento dos backups
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +"%Y-%m-%d_%H%M%S")"
BACKUP_FILENAME="ortho_${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "=========================================================="
echo " [$(date +"%Y-%m-%d %H:%M:%S")] Iniciando backup do banco de dados..."
echo " Banco: $DB_NAME | Usuário: $DB_USER | Retenção: ${RETENTION_DAYS} dias"
echo " Destino: $BACKUP_FILEPATH"
echo "=========================================================="

# 1. Identificar o container de banco de dados
CONTAINER_ID=$(docker ps --filter "name=database" --filter "status=running" --format "{{.ID}}" | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    # Tenta identificar por postgres
    CONTAINER_ID=$(docker ps --filter "ancestor=postgres:16-alpine" --filter "status=running" --format "{{.ID}}" | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ ERRO: Container do PostgreSQL não encontrado ou não está rodando." >&2
    exit 1
fi

echo "✅ Container identificado: $CONTAINER_ID"

# 2. Executar pg_dump e comprimir com gzip diretamente
echo "⏳ Exportando dados com pg_dump..."
if docker exec -t "$CONTAINER_ID" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILEPATH"; then
    FILE_SIZE=$(du -h "$BACKUP_FILEPATH" | cut -f1)
    echo "✅ Backup gerado com sucesso! Tamanho: $FILE_SIZE"
else
    echo "❌ ERRO: Falha ao gerar o dump do PostgreSQL." >&2
    rm -f "$BACKUP_FILEPATH"
    exit 1
fi

# 3. Limpeza de backups antigos com base na política de retenção
echo "🧹 Limpando backups com mais de ${RETENTION_DAYS} dias..."
DELETED_COUNT=$(find "$BACKUP_DIR" -type f -name "ortho_${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" | wc -l)
find "$BACKUP_DIR" -type f -name "ortho_${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "ℹ️  Arquivos antigos removidos: $DELETED_COUNT"
echo "🏁 [$(date +"%Y-%m-%d %H:%M:%S")] Backup finalizado com sucesso."
