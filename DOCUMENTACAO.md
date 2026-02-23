# Documentação do Sistema Kanbou

**Plataforma de Gestão de Agência de Mídias Sociais**
**Versão:** 1.0 | **Domínio:** kanbou.com.br

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Acesso e Autenticação](#2-acesso-e-autenticação)
3. [Perfis de Usuário e Permissões](#3-perfis-de-usuário-e-permissões)
4. [Módulos do Sistema](#4-módulos-do-sistema)
   - 4.1 [Dashboard](#41-dashboard)
   - 4.2 [Quadro Kanban](#42-quadro-kanban)
   - 4.3 [Aprovações (Painel do Cliente)](#43-aprovações-painel-do-cliente)
   - 4.4 [Calendário e Agendamento](#44-calendário-e-agendamento)
   - 4.5 [Insights](#45-insights)
   - 4.6 [Briefings](#46-briefings)
   - 4.7 [Onboarding de Clientes](#47-onboarding-de-clientes)
   - 4.8 [Link Page (Linktree)](#48-link-page-linktree)
   - 4.9 [Relatórios](#49-relatórios)
   - 4.10 [Gestão de Usuários](#410-gestão-de-usuários)
   - 4.11 [Configurações do Sistema](#411-configurações-do-sistema)
   - 4.12 [Relatórios de Erros](#412-relatórios-de-erros)
5. [Sistema de Notificações](#5-sistema-de-notificações)
6. [Integração com Google Drive](#6-integração-com-google-drive)
7. [Tipos de Cartão Kanban](#7-tipos-de-cartão-kanban)
8. [Fluxo de Trabalho (Workflow)](#8-fluxo-de-trabalho-workflow)
9. [Arquitetura Técnica](#9-arquitetura-técnica)
10. [API - Referência Completa](#10-api---referência-completa)
11. [Banco de Dados](#11-banco-de-dados)
12. [Deploy e Infraestrutura](#12-deploy-e-infraestrutura)

---

## 1. Visão Geral

O **Kanbou** é uma plataforma completa de gestão para agências de mídias sociais brasileiras. Ele permite gerenciar clientes, criar e acompanhar materiais de produção em quadros Kanban, enviar materiais para aprovação do cliente, agendar publicações, gerar relatórios de produtividade e manter um repositório organizado de arquivos no Google Drive.

**Principais funcionalidades:**
- Quadro Kanban personalizado por cliente com fluxo de produção completo
- Sistema de aprovação de materiais integrado ao Kanban
- Agendamento de posts com calendário visual
- Dashboard com métricas por cliente e geral
- Onboarding completo de clientes com dados, credenciais, produtos e serviços
- Integração com Google Drive para armazenamento de arquivos
- Sistema de notificações em tempo real
- Relatórios de fluxo de trabalho, atividade por usuário e por cliente
- Personalização visual do sistema (logo, favicon, temas)
- Páginas públicas estilo Linktree para clientes
- Módulo de briefings com templates customizáveis
- Toda interface em Português Brasileiro (PT-BR)

---

## 2. Acesso e Autenticação

### Login
- **URL:** `https://kanbou.com.br`
- **Método:** Email + Senha
- **Sessão:** Mantida via cookies (express-session + PostgreSQL)

### Registro de Usuários
- Apenas administradores podem criar novos usuários
- Senhas são criptografadas com bcrypt
- Mínimo de 6 caracteres para senha

### Segurança
- Proteção contra brute force com rate limiting (5 tentativas por 15 minutos)
- Sessões armazenadas no PostgreSQL
- Todas as rotas da API são protegidas por autenticação (exceto login, branding e páginas públicas)

---

## 3. Perfis de Usuário e Permissões

### Papéis (Roles)

| Papel | Código | Descrição |
|-------|--------|-----------|
| Administrador | `admin` | Acesso total ao sistema |
| Designer | `designer` | Produção de materiais visuais |
| Redator | `redator` | Produção de textos e copies |
| Gerente | `gerente` | Gestão de clientes e equipe |
| Audiovisual | `audiovisual` | Produção de vídeos e fotos |
| Atendimento | `atendimento` | Relacionamento com clientes |
| Cliente | `client` | Visualização e aprovação de materiais |

### Papéis Internos vs Cliente
- **Internos** (admin, designer, redator, gerente, audiovisual, atendimento): Podem criar, editar e mover cartões no Kanban, criar posts, gerenciar aprovações.
- **Cliente**: Visualiza apenas seus próprios cartões em aprovação, aprova/reprova materiais, envia comentários.

### Permissões Disponíveis

| Permissão | Descrição |
|-----------|-----------|
| `dashboard` | Visualizar painel de controle |
| `posts_view` | Visualizar lista de posts |
| `posts_create` | Criar novos posts |
| `posts_edit` | Editar posts existentes |
| `posts_delete` | Excluir posts |
| `calendar` | Visualizar calendário de agendamentos |
| `approvals_view` | Visualizar aprovações |
| `approvals_create` | Criar novas aprovações |
| `approvals_edit` | Editar aprovações existentes |
| `briefings_view` | Visualizar briefings |
| `briefings_manage` | Criar e excluir briefings |
| `clients_view` | Visualizar lista de clientes |
| `clients_manage` | Criar, editar e excluir clientes |
| `users_manage` | Criar, editar e excluir usuários |

### Flag `isManager`
- Usuários com `isManager = true` podem vincular outros usuários a clientes específicos através da tabela `user_client_access`.
- Gerentes veem apenas os clientes aos quais estão vinculados.

---

## 4. Módulos do Sistema

### 4.1 Dashboard

**Rota:** `/`

O dashboard apresenta uma visão consolidada da operação:

**Para Administradores/Internos:**
- Total de clientes, posts agendados, aprovações pendentes
- Gráficos com distribuição por plataforma
- Resumo de atividade recente

**Para Clientes:**
- Dashboard simplificado mostrando apenas dados do próprio cliente
- Contagem de materiais em cada status de aprovação

---

### 4.2 Quadro Kanban

**Rota:** `/kanban/:clientId`

O coração do sistema. Cada cliente possui seu próprio quadro Kanban com colunas que representam as etapas de produção.

#### Colunas Padrão (em ordem)

| # | Coluna | Função |
|---|--------|--------|
| 1 | **Fila** | Cartões recém-criados aguardam aqui |
| 2 | **Desenvolvendo Copy** | Redação de textos |
| 3 | **Finalizado Copy** | Texto pronto (pausa timer) |
| 4 | **Desenvolvendo Design** | Criação visual |
| 5 | **Revisar Criação** | Revisão interna do design |
| 6 | **Tráfego e RDS** | Preparação para tráfego/mídia |
| 7 | **Em Aprovação** | Aguardando aprovação do cliente |
| 8 | **Revisão** | Cliente solicitou alterações |
| 9 | **Aprovados** | Material aprovado pelo cliente |
| 10 | **Agendamento** | Aguardando ser agendado |
| 11 | **Agendados** | Confirmado para publicação |
| 12 | **Postados** | Publicado na plataforma |
| 13 | **Finalizados** | Processo concluído |
| 14 | **Reprovados** | Material reprovado pelo cliente |

#### Colunas Condicionais
- **Reunião**: Aparece quando `enableReuniao = true` no cliente
- **Captação**: Aparece quando `enableCaptacao = true` no cliente

#### Regras do Kanban
- **Criação obrigatória na Fila**: Todo cartão novo é criado na coluna "Fila". O botão "Adicionar cartão" só aparece nesta coluna.
- **Colunas protegidas**: Todas as colunas padrão não podem ser deletadas ou renomeadas.
- **Movimentação protegida**: Algumas movimentações são restritas:
  - Aprovados → Agendados/Postados
  - Agendados → Postados/Finalizados
  - Postados → Finalizados
- **Arrastar cartões**: Cartões podem ser arrastados pela superfície inteira.
- **Duplo clique**: Abre o modal de detalhes do cartão.
- **Voltar p/ Fila**: Botão disponível em Postados, Finalizados e Agendados para reiniciar o fluxo.

#### Detalhes do Cartão (Modal)
- Título, descrição (editor rich text)
- Tipo de cartão com campos específicos
- Capa (imagem de capa com upload)
- Data de vencimento
- Usuários atribuídos
- Anexos (armazenados no Google Drive)
- Checklist
- Comentários (com notificações)
- Histórico de atividades
- Rastreamento de tempo por coluna

#### Agendamento Atrasado
Cartões do tipo "Post" com `publishDate` no passado são automaticamente movidos para uma seção "Agendamento Atrasado" no rodapé da coluna, destacados com um divisor vermelho e ícone de alerta. Colunas "Agendados", "Postados" e "Finalizados" são isentas.

#### Background Personalizado
Administradores podem definir cor de fundo ou imagem de fundo personalizada para o quadro de cada cliente.

---

### 4.3 Aprovações (Painel do Cliente)

**Rota:** `/client-approvals`

Página dedicada para clientes visualizarem e atualizarem o status dos materiais enviados para aprovação.

**Funcionalidades:**
- Lista de cartões em status "Em Aprovação"
- Pré-visualização de imagens anexadas (via proxy seguro do Google Drive)
- Galeria de imagens com zoom
- Botões para Download e Visualizar no Drive
- Ações: Aprovar, Solicitar Revisão, Reprovar
- Campo de observações para cada decisão
- Badge de notificação mostrando quantidade de materiais pendentes
- Notificações marcadas como lidas apenas ao abrir o cartão específico

**Fluxo de Aprovação:**
1. Designer envia cartão para aprovação → cartão move para "Em Aprovação"
2. Cliente recebe notificação e vê o badge no menu
3. Cliente abre o material, visualiza as imagens
4. Cliente toma uma decisão:
   - **Aprovar** → cartão move para "Aprovados"
   - **Revisão** → cartão move para "Revisão" (designer pode reenviar)
   - **Reprovar** → cartão move para "Reprovados"
5. Botão de desfazer permite reverter qualquer decisão

---

### 4.4 Calendário e Agendamento

**Rota:** `/calendar`

Visualização em calendário dos posts agendados.

**Funcionalidades:**
- Visualização mensal com indicadores de posts por dia
- Filtro por cliente
- Cores por plataforma
- Recurso "Agendar Aprovado" com processo guiado em 2 etapas
- Importação de cartões Kanban aprovados como posts

---

### 4.5 Insights

**Rota:** `/insights`

Página dedicada para registro de insights e observações sobre clientes.

**Funcionalidades:**
- Criação de insights com editor rich text (TipTap)
- Agrupamento por data
- Filtro por cliente
- Design visual atrativo
- Cliente pode visualizar insights do próprio cliente
- Notificações enviadas quando insights são postados (cliente↔admin)
- Lista expansível de clientes na sidebar

---

### 4.6 Briefings

**Rota:** `/briefings`

Módulo para coleta de informações de marca e projetos dos clientes.

**Tipos de Briefing:**
- **Briefing de Marca (brand)**: Perguntas fixas sobre identidade da marca
- **Briefing Customizado (custom)**: Baseado em templates com perguntas personalizáveis

**Templates de Briefing:**
- Admin/designer pode criar templates reutilizáveis
- Tipos de pergunta: texto, seletor de cor, upload de arquivo
- Gerenciamento na aba "Templates" da página de briefings

**Página Pública:**
- Cada briefing gera um link público (`/briefing/:token`)
- Cliente responde sem precisar de login
- Suporte a upload de arquivos (limite 10MB)
- Respostas salvas automaticamente

---

### 4.7 Onboarding de Clientes

**Rota:** `/onboarding/:clientId`

Página completa de cadastro e configuração de cada cliente.

**Seções:**

| Seção | Conteúdo |
|-------|----------|
| **Sobre** | Descrição da empresa (editor rich text) |
| **Anotações** | Notas livres (editor rich text) |
| **Produtos** | Cadastro de produtos do cliente |
| **Serviços** | Cadastro de serviços oferecidos |
| **Credenciais** | Logins de redes sociais (armazenados de forma segura) |
| **Concorrentes** | Perfis de concorrentes com links |
| **Hashtags/Tags** | Tags e hashtags frequentes |
| **Tags de Mercado** | Segmentação de mercado |
| **Identidade Visual** | Upload de manuais de marca, logos, tipografia (Google Drive) |
| **Link Page** | Configuração da página pública estilo Linktree |
| **Controle de Acesso** | Definir quais usuários têm acesso ao onboarding |

---

### 4.8 Link Page (Linktree)

**Rota pública:** `/link/:slug`

Página pública por cliente mostrando informações comerciais.

**Funcionalidades:**
- Bio e informações do negócio
- Links de redes sociais (WhatsApp, Instagram, Facebook, TikTok, LinkedIn, YouTube)
- Links de contato (telefone, email, website)
- Listagem de produtos e serviços
- Menu responsivo (Sobre/Produtos/Serviços - seções mostradas apenas se houver dados)
- Cores personalizáveis (primária e secundária)
- Link copiável para bio do Instagram

---

### 4.9 Relatórios

**Rota:** `/reports`

Três abas de relatórios:

#### Fluxo de Trabalho
- Métricas de produção com filtros por cliente, tipo de cartão, usuário e período
- Gráficos via Recharts
- Tempo médio por etapa de produção

#### Atividade por Usuário
- Rastreamento baseado em movimentações de cartões
- Quem moveu quais cartões
- Tempo gasto por coluna
- Métricas de estágio de produção

#### Relatório por Cliente
- Atividade mensal por cliente
- Cartões criados no período
- Status de aprovação (breakdown)
- Estatísticas de posts
- Distribuição por tipo (gráfico de pizza)
- Distribuição por plataforma (gráfico de barras)
- Filtro por cliente, mês e ano

---

### 4.10 Gestão de Usuários

**Rota:** `/users` (apenas admin)

- Criar, editar e desativar usuários
- Definir papel e permissões
- Vincular usuários internos a clientes específicos (para gerentes)
- Flag de gerente (`isManager`)

---

### 4.11 Configurações do Sistema

**Rota:** `/settings` (apenas admin)

#### Personalização Visual
- Upload de logo customizado
- Upload de favicon customizado
- Nome do sistema (substitui "Shift" em todos os lugares)
- Seleção de tema:
  - **Clássico**: Verde (padrão)
  - **Business**: Azul/índigo corporativo
  - **Criativo**: Roxo/rosa vibrante

#### Credenciais Google Drive
- Configuração de Client ID, Client Secret e Refresh Token
- Validação antes de salvar
- Armazenamento criptografado no banco
- Fallback para variáveis de ambiente se não configurado no banco

---

### 4.12 Relatórios de Erros

**Rota:** `/error-reports` (apenas admin para visualizar)

- Qualquer usuário autenticado pode enviar relatórios de erro
- Níveis de severidade: baixa, média, alta, crítica
- Status: aberto, em andamento, resolvido, ignorado
- CRUD completo para administradores

---

## 5. Sistema de Notificações

### Funcionamento
- Sino de notificação na sidebar (desktop) e no header mobile
- Badge com contagem de não lidas
- Polling a cada 15 segundos
- Badges específicos nos itens do menu Kanban e Aprovações

### Gatilhos de Notificação

| Evento | Destinatário |
|--------|-------------|
| Material enviado para aprovação | Cliente do cartão |
| Material aprovado | Equipe interna |
| Material reprovado | Equipe interna |
| Revisão solicitada | Equipe interna |
| Comentário adicionado | Usuários do cartão |
| Cartão agendado | Equipe interna |
| Insight criado | Cliente↔Admin (bidirecional) |

### Notificações por Cartão
- Cada notificação de aprovação está vinculada ao `kanbanCardId` específico
- Notificações são marcadas como lidas apenas quando o cliente abre o cartão correspondente
- Badge no menu "Aprovações" mostra quantidade de cartões com notificações pendentes

### Endpoints de Notificação
- `GET /api/notifications` - Listar notificações do usuário
- `GET /api/notifications/unread-count` - Contagem de não lidas
- `PUT /api/notifications/:id/read` - Marcar como lida
- `PUT /api/notifications/read-all` - Marcar todas como lidas
- `PUT /api/notifications/read-kanban` - Marcar notificações Kanban como lidas
- `PUT /api/notifications/read-insights` - Marcar notificações de insights como lidas
- `PUT /api/notifications/read-by-card/:cardId` - Marcar notificações de um cartão específico como lidas

---

## 6. Integração com Google Drive

### Configuração
As credenciais OAuth2 podem ser configuradas de duas formas:
1. **Via painel admin** (Configurações → Google Drive) - Armazenadas criptografadas no banco
2. **Via variáveis de ambiente** - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

### Estrutura de Pastas
```
Cliente/
├── {YYYY}/
│   └── {MM}/
│       ├── Kanban/
│       │   └── {extensão}/
│       │       └── YYYY-MM-DD_HHmm_nome-do-arquivo.ext
│       └── Aprovações/
│           └── arquivos de aprovação
```

### Funcionalidades
- Upload de arquivos anexos dos cartões Kanban
- Upload de arquivos de identidade visual
- Listagem de arquivos com busca retrocompatível (estrutura legacy + nova)
- Proxy seguro para visualização de imagens (`/api/drive-proxy/:fileId`)
- Download direto de arquivos do Drive
- Sincronização de pastas por cliente
- Normalização de nomes de arquivo com prefixo de data

### Proxy de Imagens
- Endpoint `/api/drive-proxy/:fileId` para streaming seguro de imagens
- Verificação de autorização (o usuário precisa ter acesso ao cartão/anexo)
- Usado nas pré-visualizações de aprovação e no modal do Kanban

---

## 7. Tipos de Cartão Kanban

Cada cartão possui um tipo que define campos específicos e cor visual.

| Tipo | Cor | Campos Específicos |
|------|-----|-------------------|
| **Geral** | Cinza | Nenhum campo adicional |
| **Post** | Azul | Headline, Título, Legenda, Plataformas (multi-select), Data de Publicação, Hashtags, Referências |
| **Vídeo** | Ciano | Título, Tipo de Vídeo, Duração, Plataformas, Legenda, Roteiro, Formato, Data, Hashtags |
| **Material Offline** | Âmbar | Título, Descrição, Formato/Tamanho, Quantidade, Prazo |
| **Material Digital** | Roxo | Título, Descrição, Formato (PDF/Banner/Email/etc), Dimensões, Prazo |
| **Copy** | Esmeralda | Título, Tipo de Texto, Público-Alvo, Tom de Voz, Prazo, Briefing |
| **Roteiro** | Vermelho | Título, Tipo, Duração, Prazo, Briefing |
| **Identidade Visual** | Rosa | Título, Tipo (Logo/Manual/etc), Descrição, Referências, Prazo |
| **Reunião** | Laranja | Título, Tipo, Data, Participantes, Local/Link, Pauta, Anotações |
| **Captação** | Teal | Título, Tipo de Captação, Data, Local, Equipamentos, Lista de Cenas, Referências |

---

## 8. Fluxo de Trabalho (Workflow)

### Rastreamento de Tempo Automático

O sistema rastreia automaticamente o tempo que cada cartão gasta em determinadas colunas:

**Colunas com timer ativo:**
- Fila
- Desenvolvendo Design
- Revisar Criação
- Desenvolvendo Copy

**Comportamento:**
- Timer inicia quando o cartão entra na coluna
- Timer para quando o cartão sai da coluna
- "Finalizado Copy" pausa o timer
- "Postados" e "Finalizados" excluem o timer

### Fluxo Típico de Produção

```
Fila → Desenvolvendo Copy → Finalizado Copy → Desenvolvendo Design 
→ Revisar Criação → Tráfego e RDS → Em Aprovação → [Decisão do Cliente]
→ Aprovados → Agendamento → Agendados → Postados → Finalizados
```

**Fluxos alternativos:**
- Cliente solicita revisão: Em Aprovação → Revisão → (Designer corrige) → Em Aprovação
- Cliente reprova: Em Aprovação → Reprovados
- Retorno ao início: Postados/Finalizados/Agendados → Fila (botão "Voltar p/ Fila")

---

## 9. Arquitetura Técnica

### Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Roteamento** | Wouter |
| **UI** | shadcn/ui (new-york) + Radix UI + Tailwind CSS |
| **Estado** | TanStack React Query v5 |
| **Formulários** | React Hook Form + Zod |
| **Gráficos** | Recharts |
| **Editor Rich Text** | TipTap |
| **Backend** | Node.js + Express 5 + TypeScript |
| **ORM** | Drizzle ORM |
| **Banco de Dados** | PostgreSQL |
| **Autenticação** | bcryptjs + express-session + connect-pg-simple |
| **Armazenamento** | Google Drive (OAuth2) + Filesystem local |

### Estrutura de Diretórios

```
kanbou/
├── client/
│   └── src/
│       ├── components/       # Componentes reutilizáveis
│       │   ├── ui/           # Componentes shadcn/ui
│       │   ├── layout.tsx    # Layout principal com sidebar
│       │   ├── kanban-card-modal.tsx  # Modal detalhes do cartão
│       │   ├── kanban-create-card-dialog.tsx  # Diálogo de criar cartão
│       │   ├── rich-text-editor.tsx   # Editor TipTap
│       │   ├── client-form.tsx        # Formulário de cliente
│       │   └── post-form.tsx          # Formulário de post
│       ├── pages/            # Páginas da aplicação
│       │   ├── kanban.tsx             # Quadro Kanban
│       │   ├── client-approvals.tsx   # Painel de aprovações (cliente)
│       │   ├── dashboard.tsx          # Dashboard
│       │   ├── briefings.tsx          # Módulo de briefings
│       │   ├── briefing-public.tsx    # Página pública de briefing
│       │   ├── insights.tsx           # Insights
│       │   ├── reports.tsx            # Relatórios
│       │   ├── client-onboarding.tsx  # Onboarding
│       │   ├── settings.tsx           # Configurações
│       │   ├── users.tsx              # Gestão de usuários
│       │   ├── calendar-view.tsx      # Calendário
│       │   ├── link-page.tsx          # Link page pública
│       │   └── ...
│       ├── hooks/            # Hooks customizados
│       ├── lib/              # Utilitários
│       └── App.tsx           # Roteamento principal
├── server/
│   ├── index.ts              # Ponto de entrada do servidor
│   ├── routes.ts             # Todas as rotas da API
│   ├── storage.ts            # Interface de armazenamento (Drizzle)
│   ├── google-drive.ts       # Integração Google Drive
│   ├── vite.ts               # Configuração do Vite (dev server)
│   └── thumbnails/           # Cache de thumbnails
├── shared/
│   ├── schema.ts             # Schemas do banco + tipos + constantes
│   └── routes.ts             # Contratos de API
├── uploads/                  # Uploads locais (logo, briefings, sistema)
├── scripts/
│   └── deploy.sh             # Script de deploy para VPS
├── DEPLOY.md                 # Guia de deploy
└── .env.example              # Variáveis de ambiente necessárias
```

### Design Pattern
- **Backend**: Interface `IStorage` para abstração do acesso a dados, implementada com Drizzle ORM
- **Frontend**: Componentes React com hooks, TanStack Query para estado do servidor, Zod para validação
- **Compartilhado**: Schemas Zod centralizados em `shared/schema.ts` para consistência de tipos entre front e back

---

## 10. API - Referência Completa

### Autenticação

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| POST | `/api/auth/register` | Criar novo usuário | Admin |
| POST | `/api/auth/login` | Login | Público |
| POST | `/api/auth/logout` | Logout | Autenticado |
| GET | `/api/auth/me` | Dados do usuário logado | Autenticado |

### Usuários

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/users` | Listar usuários | Autenticado |
| POST | `/api/users` | Criar usuário | Admin |
| PUT | `/api/users/:id` | Editar usuário | Admin |
| DELETE | `/api/users/:id` | Excluir usuário | Admin |
| GET | `/api/users/:id/client-access` | Ver acesso a clientes | Autenticado |
| PUT | `/api/users/:id/client-access` | Definir acesso a clientes | Autenticado |

### Clientes

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/clients` | Listar clientes | Autenticado |
| GET | `/api/clients/:id` | Detalhes do cliente | Autenticado |
| POST | `/api/clients` | Criar cliente | Admin |
| PUT | `/api/clients/:id` | Editar cliente | Admin |
| DELETE | `/api/clients/:id` | Excluir cliente | Admin |
| PUT | `/api/clients/:id/about` | Atualizar "sobre" | Autenticado |
| PUT | `/api/clients/:id/notes` | Atualizar notas | Autenticado |
| PUT | `/api/clients/:id/tags` | Atualizar tags | Autenticado |
| PUT | `/api/clients/:id/market-tags` | Atualizar tags de mercado | Autenticado |
| POST | `/api/clients/:id/suggest-tags` | Sugerir tags | Autenticado |
| POST | `/api/clients/:id/suggest-market-tags` | Sugerir tags de mercado | Autenticado |
| PUT | `/api/clients/:id/kanban-bg` | Definir fundo do Kanban | Interno |

### Posts

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/posts` | Listar posts | Autenticado |
| GET | `/api/posts/:id` | Detalhes do post | Autenticado |
| POST | `/api/posts` | Criar post | Interno |
| PUT | `/api/posts/:id` | Editar post | Interno |
| DELETE | `/api/posts/:id` | Excluir post | Admin |
| POST | `/api/posts/import-approval` | Importar de aprovação | Interno |
| POST | `/api/posts/import-kanban-card` | Importar de cartão Kanban | Interno |

### Kanban

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/kanban/:clientId/columns` | Listar colunas | Autenticado |
| POST | `/api/kanban/:clientId/columns` | Criar coluna | Interno |
| PUT | `/api/kanban/columns/:id` | Editar coluna | Interno |
| DELETE | `/api/kanban/columns/:id` | Excluir coluna | Interno |
| PUT | `/api/kanban/:clientId/columns/reorder` | Reordenar colunas | Interno |
| GET | `/api/kanban/:clientId/cards` | Listar cartões | Autenticado |
| GET | `/api/kanban/cards/:id` | Detalhes do cartão | Autenticado |
| POST | `/api/kanban/cards` | Criar cartão | Autenticado |
| PUT | `/api/kanban/cards/:id` | Editar cartão | Autenticado |
| DELETE | `/api/kanban/cards/:id` | Excluir cartão | Interno |
| PUT | `/api/kanban/cards/:id/move` | Mover cartão | Autenticado |
| PUT | `/api/kanban/cards/:id/back-to-fila` | Voltar para Fila | Interno |
| POST | `/api/kanban/cards/:id/send-approval` | Enviar para aprovação | Interno |
| POST | `/api/kanban/cards/:id/approve` | Aprovar cartão | Autenticado |
| POST | `/api/kanban/cards/:id/reject` | Reprovar cartão | Autenticado |
| POST | `/api/kanban/cards/:id/revision` | Solicitar revisão | Autenticado |
| POST | `/api/kanban/cards/:id/undo-approval` | Desfazer decisão | Autenticado |
| POST | `/api/kanban/cards/:id/cover-upload` | Upload de capa | Autenticado |
| GET | `/api/kanban/approved-cards` | Cartões aprovados | Interno |
| GET | `/api/kanban/scheduled-cards` | Cartões agendados | Autenticado |
| GET | `/api/client/approval-cards` | Cartões para aprovação (cliente) | Autenticado |

### Aprovações (Legacy)

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/approvals` | Listar aprovações | Autenticado |
| GET | `/api/approvals/:id` | Detalhes | Autenticado |
| POST | `/api/approvals` | Criar aprovação | Interno |
| PUT | `/api/approvals/:id` | Atualizar aprovação | Autenticado |
| DELETE | `/api/approvals/:id` | Excluir aprovação | Autenticado |
| GET | `/api/approvals/stats/by-client` | Estatísticas | Autenticado |
| GET | `/api/approvals/approved` | Aprovados | Interno |
| GET | `/api/approvals/:id/drive-files` | Arquivos Drive | Autenticado |
| GET | `/api/approvals/:id/drive-history` | Histórico Drive | Autenticado |

### Notificações

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/notifications` | Listar notificações | Autenticado |
| GET | `/api/notifications/unread-count` | Contagem não lidas | Autenticado |
| PUT | `/api/notifications/:id/read` | Marcar como lida | Autenticado |
| PUT | `/api/notifications/read-all` | Marcar todas como lidas | Autenticado |
| PUT | `/api/notifications/read-kanban` | Marcar Kanban como lidas | Autenticado |
| PUT | `/api/notifications/read-insights` | Marcar insights como lidas | Autenticado |
| PUT | `/api/notifications/read-by-card/:cardId` | Marcar por cartão como lidas | Autenticado |

### Briefings

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/briefings` | Listar briefings | Autenticado |
| GET | `/api/briefings/:id` | Detalhes | Autenticado |
| POST | `/api/briefings` | Criar briefing | Interno |
| PUT | `/api/briefings/:id` | Editar briefing | Interno |
| DELETE | `/api/briefings/:id` | Excluir briefing | Interno |
| GET | `/api/briefings/public/:token` | Briefing público | Público |
| PUT | `/api/briefings/public/:token` | Responder briefing | Público |
| GET | `/api/briefings/public/:token/template` | Template público | Público |

### Templates de Briefing

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/briefing-templates` | Listar templates | Autenticado |
| GET | `/api/briefing-templates/:id` | Detalhes | Autenticado |
| POST | `/api/briefing-templates` | Criar template | Interno |
| PUT | `/api/briefing-templates/:id` | Editar template | Interno |
| DELETE | `/api/briefing-templates/:id` | Excluir template | Interno |

### Onboarding

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/onboarding/:clientId/products` | Listar produtos | Autenticado |
| POST | `/api/onboarding/:clientId/products` | Adicionar produto | Autenticado |
| PUT | `/api/onboarding/products/:id` | Editar produto | Interno |
| DELETE | `/api/onboarding/products/:id` | Excluir produto | Interno |
| GET | `/api/onboarding/:clientId/services` | Listar serviços | Autenticado |
| POST | `/api/onboarding/:clientId/services` | Adicionar serviço | Autenticado |
| PUT | `/api/onboarding/services/:id` | Editar serviço | Interno |
| DELETE | `/api/onboarding/services/:id` | Excluir serviço | Interno |
| GET | `/api/onboarding/:clientId/credentials` | Listar credenciais | Autenticado |
| POST | `/api/onboarding/:clientId/credentials` | Adicionar credencial | Autenticado |
| PUT | `/api/onboarding/credentials/:id` | Editar credencial | Interno |
| DELETE | `/api/onboarding/credentials/:id` | Excluir credencial | Interno |
| GET | `/api/onboarding/:clientId/text-templates` | Listar templates texto | Autenticado |
| POST | `/api/onboarding/:clientId/text-templates` | Adicionar template | Autenticado |
| PUT | `/api/onboarding/text-templates/:id` | Editar template | Interno |
| DELETE | `/api/onboarding/text-templates/:id` | Excluir template | Interno |
| GET | `/api/onboarding/:clientId/insights` | Listar insights | Autenticado |
| POST | `/api/onboarding/:clientId/insights` | Criar insight | Autenticado |
| DELETE | `/api/onboarding/insights/:id` | Excluir insight | Autenticado |
| GET | `/api/onboarding/:clientId/access` | Ver controle de acesso | Admin |
| PUT | `/api/onboarding/:clientId/access` | Definir acesso | Admin |

### Concorrentes

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/competitors` | Listar todos | Autenticado |
| GET | `/api/competitors/by-client/:clientId` | Listar por cliente | Autenticado |
| POST | `/api/competitors` | Adicionar | Interno + Cliente |
| PUT | `/api/competitors/:id` | Editar | Interno + Cliente |
| DELETE | `/api/competitors/:id` | Excluir | Interno + Cliente |

### Identidade Visual (Brand Identity)

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/clients/:clientId/brand-identity` | Listar arquivos | Autenticado |
| POST | `/api/clients/:clientId/brand-identity` | Upload de arquivo | Interno + Cliente |
| DELETE | `/api/brand-identity/:id` | Excluir arquivo | Interno |

### Google Drive

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/drive/status` | Status da conexão | Admin |
| POST | `/api/drive/sync-client/:id` | Sincronizar cliente | Admin |
| POST | `/api/drive/sync-all` | Sincronizar todos | Admin |
| GET | `/api/drive/file/:fileId/download` | Download de arquivo | Autenticado |
| GET | `/api/drive-proxy/:fileId` | Proxy de imagem | Autenticado |

### Configurações

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/settings/drive` | Configurações Drive | Admin |
| POST | `/api/settings/drive` | Salvar credenciais Drive | Admin |
| DELETE | `/api/settings/drive` | Remover credenciais Drive | Admin |
| GET | `/api/settings/branding` | Branding do sistema | Público |
| PUT | `/api/settings/branding` | Atualizar branding | Admin |

### Relatórios de Erros

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/error-reports` | Listar erros | Admin |
| POST | `/api/error-reports` | Reportar erro | Autenticado |
| PATCH | `/api/error-reports/:id` | Atualizar status | Admin |

### Relatórios

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/reports/card-times` | Tempos de cartão | Interno |
| GET | `/api/reports/workflow` | Fluxo de trabalho | Interno |
| GET | `/api/reports/movements` | Movimentações | Interno |
| GET | `/api/reports/client-activity` | Atividade por cliente | Autenticado |

### Dashboard

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | `/api/dashboard/client-summary` | Resumo por cliente | Autenticado |
| GET | `/api/insights/overview` | Visão geral de insights | Autenticado |

### Uploads

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| POST | `/api/uploads/briefing` | Upload de briefing | Público |
| GET | `/api/uploads/briefing/:filename` | Arquivo de briefing | Público |
| POST | `/api/uploads/briefing-file` | Upload arquivo briefing | Público |
| POST | `/api/uploads/logo` | Upload de logo | Autenticado |
| GET | `/api/uploads/logo/:filename` | Arquivo de logo | Público |
| POST | `/api/uploads/system/:type` | Upload do sistema | Admin |
| GET | `/api/uploads/system/:filename` | Arquivo do sistema | Público |

---

## 11. Banco de Dados

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema |
| `clients` | Clientes da agência |
| `posts` | Posts agendados |
| `approval_posts` | Posts para aprovação (legacy) |
| `notifications` | Sistema de notificações |
| `competitors` | Concorrentes dos clientes |
| `kanban_columns` | Colunas dos quadros Kanban |
| `kanban_cards` | Cartões do Kanban |
| `kanban_comments` | Comentários nos cartões |
| `kanban_activity` | Log de atividades do Kanban |
| `kanban_time_entries` | Rastreamento de tempo por coluna |
| `user_client_access` | Vínculo usuário-cliente |
| `briefings` | Briefings enviados |
| `briefing_templates` | Templates de briefing |
| `client_products` | Produtos dos clientes |
| `client_services` | Serviços dos clientes |
| `client_custom_links` | Links customizados (link page) |
| `client_credentials` | Credenciais de redes sociais |
| `client_insights` | Insights por cliente |
| `client_onboarding_access` | Controle de acesso ao onboarding |
| `client_text_templates` | Templates de texto reutilizáveis |
| `brand_identity_files` | Arquivos de identidade visual |
| `error_reports` | Relatórios de erros |
| `system_settings` | Configurações do sistema |
| `session` | Sessões de usuário (connect-pg-simple) |

### Diagrama Simplificado de Relacionamentos

```
users ─────────────┬──── kanban_comments
  │                │──── kanban_activity
  │                │──── kanban_time_entries
  │                │──── client_insights
  │                │──── briefings
  │                │──── error_reports
  │                └──── notifications
  │
  ├── user_client_access ──── clients
  │
clients ───────────┬──── kanban_columns ──── kanban_cards
  │                │──── posts
  │                │──── approval_posts
  │                │──── competitors
  │                │──── client_products
  │                │──── client_services
  │                │──── client_custom_links
  │                │──── client_credentials
  │                │──── client_insights
  │                │──── client_onboarding_access
  │                │──── client_text_templates
  │                │──── brand_identity_files
  │                └──── notifications
  │
briefing_templates ──── briefings
system_settings (chave-valor independente)
```

---

## 12. Deploy e Infraestrutura

### Ambiente de Produção

| Item | Valor |
|------|-------|
| **Servidor** | Hostinger VPS |
| **IP** | 195.35.18.161 |
| **Domínio** | kanbou.com.br |
| **Process Manager** | PM2 |
| **Banco de Dados** | PostgreSQL local |
| **Proxy Reverso** | Nginx |

### Fluxo de Deploy

```
Replit (desenvolvimento) → GitHub (backup) → VPS (produção)
```

1. Desenvolver no Replit
2. Executar `bash scripts/deploy.sh`
3. O script faz build, push para GitHub, SSH para VPS, pull e restart

### Variáveis de Ambiente Necessárias

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_SECRET=chave-secreta-de-sessao
GOOGLE_CLIENT_ID=id-do-oauth2
GOOGLE_CLIENT_SECRET=secret-do-oauth2
GOOGLE_REFRESH_TOKEN=token-de-refresh
NODE_ENV=production
PORT=3000
```

### Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Iniciar em modo desenvolvimento |
| `npm run build` | Compilar para produção |
| `npm start` | Iniciar em produção |
| `npm run db:push` | Sincronizar schema do banco |
| `bash scripts/deploy.sh` | Deploy completo para VPS |

### Repositório GitHub
- **URL:** github.com/renatovsantana/kanbou
- **Branch:** main
- **Tipo:** Privado

---

*Documentação gerada em Fevereiro de 2026.*
*Sistema Kanbou - Gestão de Agência de Mídias Sociais*
