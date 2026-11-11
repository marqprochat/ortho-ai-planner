#!/usr/bin/env bash
# ==============================================================================
# Ortho AI Planner - Script de Restauração do PostgreSQL
# ==============================================================================
# Utilização:
#   chmod +x restore.sh
#   ./restore.sh /caminho/para/ortho_portalclinicas_YYYY-MM-DD_HHMMSS.sql.gz
# ==============================================================================

set -eo pipefail

if [ -z "$1" ]; then
    echo "Uso: $0 <caminho_do_arquivo_backup.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

DB_USER="${DB_USER:-ortho}"
DB_NAME="${DB_NAME:-portalclinicas}"

echo "⚠️  ATENÇÃO: Este procedimento substituirá os dados atuais no banco '$DB_NAME'."
read -p "Deseja realmente continuar? (digite 'sim' para prosseguir): " CONFIRM

if [ "$CONFIRM" != "sim" ]; then
    echo "Operação cancelada."
    exit 0
fi

CONTAINER_ID=$(docker ps --filter "name=database" --filter "status=running" --format "{{.ID}}" | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    CONTAINER_ID=$(docker ps --filter "ancestor=postgres:16-alpine" --filter "status=running" --format "{{.ID}}" | head -n 1)
fi

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ Container do banco de dados não encontrado."
    exit 1
fi

echo "🔄 Restaurando banco $DB_NAME a partir de $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_ID" psql -U "$DB_USER" -d "$DB_NAME"

echo "✅ Restauração concluída com sucesso!"
