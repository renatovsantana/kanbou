#!/bin/bash
set -e

echo "============================================"
echo "  KANBOU - Script de Deploy Automatizado"
echo "============================================"
echo ""

VPS_HOST="195.35.18.161"
VPS_USER="root"
VPS_PATH="/var/www/kanbou"
VCS=$(which git 2>/dev/null || echo "git")

echo "[1/5] Building project..."
npm run build
echo "Build concluido com sucesso!"
echo ""

echo "[2/5] Uploading files to VPS..."
sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no dist/index.cjs ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/dist/index.cjs
sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no -r dist/public ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/dist/
echo "Build files enviados!"
echo ""

echo "[3/5] Syncing source files to VPS..."
tar czf /tmp/kanbou-src.tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  --exclude=uploads \
  --exclude=.env \
  --exclude=.cache \
  --exclude=.config \
  --exclude=.local \
  --exclude=.replit \
  --exclude=attached_assets \
  --exclude=.upm \
  --exclude='*.tar.gz' .

sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/kanbou-src.tar.gz ${VPS_USER}@${VPS_HOST}:/tmp/kanbou-src.tar.gz
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cd ${VPS_PATH} && tar xzf /tmp/kanbou-src.tar.gz --exclude='.env' --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='uploads'"
echo "Source files sincronizados!"
echo ""

echo "[4/5] Pushing to GitHub from VPS..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cd ${VPS_PATH} && bash /tmp/vps-push.sh"
echo "Codigo enviado ao GitHub!"
echo ""

echo "[5/5] Restarting application on VPS..."
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "cd ${VPS_PATH} && npx drizzle-kit push --force 2>&1 | tail -5 && pm2 restart kanbou --update-env && sleep 3 && pm2 status kanbou"
echo ""

echo "============================================"
echo "  Deploy concluido com sucesso!"
echo "  Site: https://kanbou.com.br"
echo "============================================"
