#!/bin/bash

# ==============================================================
#  Kanbou - Script de Setup do Servidor (Hostinger VPS / Ubuntu)
# ==============================================================

set -e

DOMAIN="${1:-SEUDOMINIO.COM.BR}"
APP_DIR="/var/www/kanbou"
DB_NAME="kanbou"
DB_USER="kanbou_user"
DB_PASS=$(openssl rand -base64 24 | tr -d '=+/')
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '=+/')

echo ""
echo "=========================================="
echo "  Kanbou - Setup do Servidor"
echo "  Dominio: $DOMAIN"
echo "=========================================="
echo ""

# 1. Atualizar sistema
echo "[1/9] Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependencias
echo "[2/9] Instalando dependencias..."
apt install -y curl git nginx certbot python3-certbot-nginx

# 3. Instalar Node.js 20
echo "[3/9] Instalando Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "  Node.js $(node -v)"
echo "  npm $(npm -v)"

# 4. Instalar PostgreSQL
echo "[4/9] Instalando PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

# 5. Configurar banco de dados
echo "[5/9] Configurando banco de dados..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# 6. Configurar pasta do projeto
echo "[6/9] Configurando projeto..."
mkdir -p $APP_DIR
mkdir -p /var/log/kanbou

if [ ! -d "$APP_DIR/.git" ]; then
    git clone https://github.com/renatovsantana/kanbou.git $APP_DIR
else
    cd $APP_DIR && git pull
fi

cd $APP_DIR

# Criar .env
cat > .env << ENVFILE
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
SESSION_SECRET=$SESSION_SECRET
PORT=5001
NODE_ENV=production

# Google Drive OAuth2 (preencha com suas credenciais)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
ENVFILE

echo "  Arquivo .env criado"

# Instalar dependencias e compilar
npm install
npm run db:push
npm run build

# Criar pastas de uploads
mkdir -p uploads/public uploads/private server/thumbnails

# 7. Configurar PM2
echo "[7/9] Configurando PM2..."
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 startup systemd -u root --hp /root
pm2 save

# 8. Configurar Nginx
echo "[8/9] Configurando Nginx..."
cp nginx/kanbou.conf /etc/nginx/sites-available/kanbou
sed -i "s/SEUDOMINIO.COM.BR/$DOMAIN/g" /etc/nginx/sites-available/kanbou
ln -sf /etc/nginx/sites-available/kanbou /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 9. SSL com Certbot
echo "[9/9] Configurando SSL (HTTPS)..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || \
    echo "  AVISO: Certbot falhou. Configure o DNS primeiro e rode: certbot --nginx -d $DOMAIN -d www.$DOMAIN"

echo ""
echo "=========================================="
echo "  SETUP COMPLETO!"
echo "=========================================="
echo ""
echo "  App:       https://$DOMAIN"
echo "  Banco:     $DB_NAME"
echo "  Usuario:   $DB_USER"
echo "  Senha DB:  $DB_PASS"
echo "  .env:      $APP_DIR/.env"
echo ""
echo "  IMPORTANTE: Guarde a senha do banco acima!"
echo ""
echo "  Comandos uteis:"
echo "    pm2 status           - Ver status do app"
echo "    pm2 logs kanbou      - Ver logs"
echo "    pm2 restart kanbou   - Reiniciar app"
echo ""
echo "  Para atualizar:"
echo "    cd $APP_DIR && git pull && npm install && npm run build && pm2 restart kanbou"
echo ""
