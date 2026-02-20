#!/bin/bash

# ==============================================================
#  Kanbou - Script de Atualizacao
# ==============================================================

APP_DIR="/var/www/kanbou"

echo "Atualizando Kanbou..."

cd $APP_DIR

echo "[1/5] Baixando atualizacoes..."
git pull origin main

echo "[2/5] Instalando dependencias..."
npm install

echo "[3/5] Atualizando banco de dados..."
npm run db:push

echo "[4/5] Compilando..."
npm run build

echo "[5/5] Reiniciando servidor..."
pm2 restart kanbou

echo ""
echo "Atualizacao concluida!"
echo "Verifique: pm2 logs kanbou"
