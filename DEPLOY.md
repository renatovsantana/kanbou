# Guia de Deploy - Kanbou (Shift Agency Manager)

## Requisitos do Servidor (Hostinger VPS)

- **Ubuntu** 22.04+ (recomendado)
- **Node.js** 20+ (instalado automaticamente pelo script)
- **PostgreSQL** 15+ (instalado automaticamente pelo script)
- **Nginx** (instalado automaticamente pelo script)
- **Mínimo**: 2GB RAM, 20GB disco

---

## Deploy Rápido (Recomendado)

### 1. Acesse o VPS via SSH

```bash
ssh root@SEU_IP_DO_VPS
```

### 2. Baixe e rode o script de setup

```bash
curl -sL https://raw.githubusercontent.com/renatovsantana/kanbou/main/scripts/setup-server.sh -o setup.sh
chmod +x setup.sh
bash setup.sh seudominio.com.br
```

O script faz tudo automaticamente:
- Instala Node.js, PostgreSQL, Nginx, PM2, Certbot
- Cria o banco de dados com senha segura
- Clona o repositório e compila
- Configura Nginx como proxy reverso
- Configura SSL/HTTPS com certificado gratuito

### 3. Anote as credenciais

Ao final do script, ele mostra as credenciais do banco. **Guarde essas informações!**

### 4. Configure o Google Drive (opcional)

Edite o arquivo `.env`:

```bash
nano /var/www/kanbou/.env
```

Preencha as credenciais do Google Drive:

```env
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REFRESH_TOKEN=seu-refresh-token
```

Reinicie:

```bash
pm2 restart kanbou
```

---

## Configuração de DNS (Registro.br)

### Registros necessários no Registro.br:

Acesse https://registro.br > faça login > selecione seu domínio > "DNS" > "Editar zona"

| Tipo  | Nome              | Valor                      | TTL   |
|-------|-------------------|----------------------------|-------|
| **A** | **@**             | `SEU_IP_DO_VPS`            | 3600  |
| **A** | **www**            | `SEU_IP_DO_VPS`            | 3600  |

**Exemplo** (se o IP do seu VPS for `154.56.78.90`):

| Tipo  | Nome              | Valor                      | TTL   |
|-------|-------------------|----------------------------|-------|
| A     | @                 | 154.56.78.90               | 3600  |
| A     | www               | 154.56.78.90               | 3600  |

### Passo a passo no Registro.br:

1. Acesse https://registro.br e faça login
2. Clique no seu domínio
3. Vá em **"DNS"** > **"Editar zona"**
4. Se usar DNS do Registro.br:
   - Apague os registros existentes (se houver)
   - Adicione um registro **tipo A**, nome **@**, valor **IP do VPS**, TTL **3600**
   - Adicione um registro **tipo A**, nome **www**, valor **IP do VPS**, TTL **3600**
   - Clique em **Salvar**
5. Se usar DNS da Hostinger:
   - No Registro.br, altere os servidores DNS para os da Hostinger:
     - `ns1.dns-parking.com`
     - `ns2.dns-parking.com`
   - Configure os registros A no painel da Hostinger

**IMPORTANTE**: A propagação do DNS pode levar de 2 a 48 horas. Normalmente leva de 15 a 30 minutos.

### Verificar se o DNS está funcionando:

```bash
# No terminal do VPS ou do seu computador:
dig seudominio.com.br +short
# Deve retornar o IP do VPS

nslookup seudominio.com.br
# Deve mostrar o IP do VPS
```

### Após o DNS propagar, configure o SSL:

Se o SSL não foi configurado durante o setup (porque o DNS ainda não tinha propagado):

```bash
certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

---

## Variáveis de Ambiente

O arquivo `.env` fica em `/var/www/kanbou/.env`:

```env
# Banco de dados (gerado automaticamente pelo setup)
DATABASE_URL=postgresql://kanbou_user:SENHA@localhost:5432/kanbou

# Sessão (gerado automaticamente pelo setup)
SESSION_SECRET=string-aleatoria-gerada

# Servidor
PORT=5000
NODE_ENV=production

# Google Drive OAuth2 (preencher manualmente)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

---

## Como Obter as Credenciais do Google Drive

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google Drive API**
4. Em "Credenciais", crie um **ID do cliente OAuth 2.0** (tipo: Aplicativo da Web)
5. Adicione `https://seudominio.com.br/api/auth/google/callback` como URI de redirecionamento
6. Anote o **Client ID** e **Client Secret**
7. Para obter o **Refresh Token**, use o [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):
   - Configure com seu Client ID e Secret (ícone de engrenagem)
   - Autorize o escopo `https://www.googleapis.com/auth/drive`
   - Troque o código de autorização por tokens
   - Copie o **Refresh Token**

---

## Estrutura no Servidor

```
/var/www/kanbou/
├── dist/
│   ├── public/              # Frontend compilado
│   └── index.cjs            # Backend compilado
├── uploads/
│   ├── public/              # Uploads públicos
│   └── private/             # Uploads privados
├── server/
│   └── thumbnails/          # Thumbnails do Kanban
├── nginx/
│   └── kanbou.conf          # Config do Nginx
├── scripts/
│   ├── setup-server.sh      # Script de instalação
│   ├── update.sh            # Script de atualização
│   └── backup.sh            # Script de backup
├── ecosystem.config.js      # Config do PM2
├── .env                     # Variáveis de ambiente
└── package.json
```

---

## Comandos Úteis

```bash
# Ver status do app
pm2 status

# Ver logs em tempo real
pm2 logs kanbou

# Reiniciar app
pm2 restart kanbou

# Parar app
pm2 stop kanbou

# Ver uso de memória/CPU
pm2 monit
```

---

## Atualização

Para atualizar o sistema quando houver novas versões:

```bash
cd /var/www/kanbou
bash scripts/update.sh
```

Ou manualmente:

```bash
cd /var/www/kanbou
git pull origin main
npm install
npm run db:push
npm run build
pm2 restart kanbou
```

---

## Backup

### Backup manual:

```bash
bash /var/www/kanbou/scripts/backup.sh
```

### Backup automático (diário às 3h da manhã):

```bash
crontab -e
# Adicione a linha:
0 3 * * * /bin/bash /var/www/kanbou/scripts/backup.sh >> /var/log/kanbou/backup.log 2>&1
```

### Restaurar backup do banco:

```bash
source /var/www/kanbou/.env
psql --dbname="$DATABASE_URL" < /var/backups/kanbou/db_XXXXXXXX.sql
```

---

## Solução de Problemas

### App não inicia
```bash
pm2 logs kanbou --lines 50
# Verifique se .env existe e está correto
cat /var/www/kanbou/.env
```

### Erro de conexão com banco
```bash
systemctl status postgresql
# Verifique a DATABASE_URL no .env
```

### Erro 502 Bad Gateway
```bash
# App não está rodando
pm2 status
pm2 restart kanbou
# Ou o Nginx não está apontando para a porta certa
nginx -t
systemctl reload nginx
```

### Erro do Google Drive
- Verifique se as credenciais estão corretas no `.env`
- O Refresh Token pode expirar se o app estiver em modo "teste" no Google Cloud Console
- Publique o app para tokens permanentes

### Upload de arquivos falha
```bash
# Verifique permissões
chmod -R 755 /var/www/kanbou/uploads
# Verifique tamanho máximo no Nginx (deve ser >= 50M)
grep client_max_body_size /etc/nginx/sites-available/kanbou
```

### Renovar SSL manualmente
```bash
certbot renew
# O Certbot configura renovação automática, mas caso precise forçar
```

### Limpar logs antigos
```bash
pm2 flush kanbou
```
