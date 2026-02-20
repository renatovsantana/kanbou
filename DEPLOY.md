# Guia de Deploy - Shift Agency Manager

## Requisitos do Servidor (Hostinger VPS)

- **Node.js** 20+ (recomendado: 20 LTS)
- **PostgreSQL** 15+
- **npm** 10+
- **Git**

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Banco de Dados PostgreSQL
DATABASE_URL=postgresql://usuario:senha@localhost:5432/shift_agency

# Sessão (gere uma string aleatória longa)
SESSION_SECRET=gere-uma-string-aleatoria-segura-aqui

# Servidor
PORT=5000
NODE_ENV=production

# Google Drive (OAuth2)
GOOGLE_CLIENT_ID=seu-client-id-do-google
GOOGLE_CLIENT_SECRET=seu-client-secret-do-google
GOOGLE_REFRESH_TOKEN=seu-refresh-token-do-google

# OpenAI (opcional - para sugestões de tags por IA)
OPENAI_API_KEY=sua-chave-openai
```

## Como Obter as Credenciais do Google Drive

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google Drive API**
4. Em "Credenciais", crie um **ID do cliente OAuth 2.0** (tipo: Aplicativo da Web)
5. Adicione `http://localhost:5000/api/auth/google/callback` como URI de redirecionamento autorizado
6. Anote o **Client ID** e **Client Secret**
7. Para obter o **Refresh Token**, use o [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):
   - Configure com seu Client ID e Secret (ícone de engrenagem)
   - Autorize o escopo `https://www.googleapis.com/auth/drive`
   - Troque o código de autorização por tokens
   - Copie o **Refresh Token**

## Instalação e Deploy

### 1. Clone o repositório no VPS

```bash
git clone <url-do-repositorio> /var/www/shift-agency
cd /var/www/shift-agency
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o banco de dados

```bash
# Crie o banco de dados PostgreSQL
sudo -u postgres createdb shift_agency

# Aplique o schema
npm run db:push
```

### 4. Compile o projeto

```bash
npm run build
```

Isso gera:
- `dist/public/` - Frontend compilado (arquivos estáticos)
- `dist/index.cjs` - Backend compilado

### 5. Inicie o servidor

```bash
npm start
```

O servidor inicia na porta definida em `PORT` (padrão: 5000).

### 6. Configure o Nginx como proxy reverso

```nginx
server {
    listen 80;
    server_name seudominio.com.br;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7. Configure o PM2 para manter o servidor rodando

```bash
npm install -g pm2

# Inicie o servidor com PM2
pm2 start dist/index.cjs --name shift-agency --env production

# Configure auto-restart no boot
pm2 startup
pm2 save
```

### 8. Configure SSL com Certbot (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br
```

## Estrutura de Arquivos no Servidor

```
/var/www/shift-agency/
├── dist/
│   ├── public/          # Frontend compilado
│   └── index.cjs        # Backend compilado
├── uploads/
│   ├── public/          # Uploads públicos
│   └── private/         # Uploads privados (logos, briefings)
├── server/
│   └── thumbnails/      # Thumbnails de imagens do Kanban
├── .env                 # Variáveis de ambiente
├── node_modules/
└── package.json
```

## Pastas Importantes

- **uploads/**: Criada automaticamente. Contém arquivos enviados pelos usuários (logos, imagens de briefings). Faça backup regularmente.
- **server/thumbnails/**: Criada automaticamente. Contém thumbnails gerados para o Kanban.

## Backup

Recomenda-se fazer backup regular de:
1. **Banco de dados**: `pg_dump shift_agency > backup_$(date +%Y%m%d).sql`
2. **Pasta uploads/**: Contém todos os arquivos enviados
3. **Pasta server/thumbnails/**: Thumbnails podem ser regenerados, mas o backup evita reprocessamento
4. **Arquivo .env**: Suas configurações e credenciais

## Atualização

Para atualizar o sistema:

```bash
cd /var/www/shift-agency
git pull
npm install
npm run db:push
npm run build
pm2 restart shift-agency
```

## Solução de Problemas

### Erro de conexão com o banco
- Verifique se o PostgreSQL está rodando: `sudo systemctl status postgresql`
- Verifique a DATABASE_URL no `.env`

### Erro do Google Drive
- Verifique se as credenciais estão corretas no `.env`
- O Refresh Token pode expirar se o app estiver em modo "teste" no Google Cloud Console. Publique o app para tokens permanentes.

### Upload de arquivos falha
- Verifique a configuração `client_max_body_size` no Nginx (deve ser >= 50M)
- Verifique permissões da pasta `uploads/`: `chmod -R 755 uploads/`

### Servidor não inicia
- Verifique os logs: `pm2 logs shift-agency`
- Verifique se a porta não está em uso: `lsof -i :5000`
