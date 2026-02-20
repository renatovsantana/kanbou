#!/bin/bash

# ==============================================================
#  Kanbou - Script de Backup
# ==============================================================

APP_DIR="/var/www/kanbou"
BACKUP_DIR="/var/backups/kanbou"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "Iniciando backup..."

echo "[1/3] Backup do banco de dados..."
source $APP_DIR/.env
pg_dump $DATABASE_URL > "$BACKUP_DIR/db_$DATE.sql"

echo "[2/3] Backup dos uploads..."
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C $APP_DIR uploads/ server/thumbnails/ 2>/dev/null

echo "[3/3] Backup do .env..."
cp $APP_DIR/.env "$BACKUP_DIR/env_$DATE.bak"

echo ""
echo "Backup concluido em: $BACKUP_DIR"
ls -lh $BACKUP_DIR/*$DATE*

# Remover backups com mais de 30 dias
find $BACKUP_DIR -type f -mtime +30 -delete
echo "Backups antigos (30+ dias) removidos."
