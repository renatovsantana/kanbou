# Shift Agency Manager

## Overview

Shift is a social media agency management tool designed for Brazilian social media agencies to manage clients and schedule posts across various platforms (Instagram, Facebook, LinkedIn, TikTok, Blog). It provides a dashboard with analytics, a post scheduler with a calendar view, client management, and an approval workflow with role-based access similar to Aprova.ai. The project aims to streamline social media content management, enhance collaboration between agencies and clients, and provide insightful analytics for performance tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Vite, Wouter for routing.
- **UI/UX**: shadcn/ui (new-york style) built on Radix UI, styled with Tailwind CSS. Utilizes Recharts for analytics and react-day-picker for calendar views.
- **State Management**: TanStack React Query for server state.
- **Forms**: React Hook Form with Zod validation.
- **Design**: Modern workspace aesthetic with a lime-green primary color, warm gray background, and dark sidebar with green accents. All user-facing text is in Brazilian Portuguese.
- **Key Features**:
    - **Kanban Approval Workflow**: All materials go through client approval directly in Kanban. Cards can be sent for approval (→ "Em aprovação"), then client can Aprovar (→ "Aprovados"), Revisar (→ "Revisão"), or Reprovar (→ "Reprovados"). Undo button allows reversing any decision. Designer can resend from "Revisão". Protected columns prevent manual card moves except: Aprovados→Agendados/Postados, Agendados→Postados/Finalizados, Postados→Finalizados. Cards are draggable by entire card surface; double-click to open card details.
    - **Scheduling**: "Agendar Aprovado" feature for scheduling approved posts with a guided two-step process.
    - **Client-Specific Views**: Clients only see their own Kanban cards and a simplified dashboard.
    - **Kanban System**: Trello-like boards per client with cards supporting details, attachments, comments, time tracking, and card type templates (Post, Material Offline, Material Digital, Copy, Roteiro, Identidade Visual, Geral) with type-specific form fields.
    - **Sidebar Navigation**: Role-aware navigation tailored for Admin, Designer, and Client roles. Quadro (Kanban) section includes expandable client list for quick navigation. Posts menu was removed.
    - **Client Onboarding**: Comprehensive onboarding page with about (rich text), free notes (rich text), products, services, social credentials, competitors, hashtags/tags, and user access control per client.
    - **Rich Text Editor**: TipTap-based rich text editor used in Kanban card descriptions, onboarding about/notes fields, and insights.
    - **Dedicated Insights Page**: Separate `/insights` page with beautiful design, grouped by date, rich text creation/display, client filter, delete confirmation. Sidebar menu item with expandable client list. Insights previously lived in onboarding, now in dedicated page. Client role auto-selects their client. Notifications sent when insights are posted (client→admin, admin→client).
    - **Colored Kanban Cards**: Cards display a colored left border strip based on card type (blue=post, amber=offline, purple=digital, emerald=copy, red=roteiro, pink=identidade visual, gray=geral).
    - **Overdue Scheduling Detection**: Post-type Kanban cards with a publishDate in the past are automatically moved to an "Agendamento Atrasado" section at the bottom of their column, separated by a red visual divider with AlertTriangle icon. Columns "Agendados", "Postados", "Finalizados" are exempt from overdue detection.
    - **Workflow Reports**: Comprehensive reports page with two tabs - "Fluxo de Trabalho" (workflow metrics with filters by client, card type, user, period, with Recharts charts) and "Atividade por Usuário" (movement-based activity tracking showing who moved cards, time per column, production stage metrics). Accessible at `/reports`.
    - **Production Stage Tracking**: Automatic time tracking for cards in "Fila", "Desenvolvendo Design", "Revisar Criação", and "Desenvolvendo Copy" columns. Timer starts when card enters these columns and stops when it leaves. "Finalizado Copy" column pauses the timer. TIMED_COLUMNS constant defines which columns are tracked.
    - **Kanban Default Columns**: Fila → Desenvolvendo Design → Revisar Criação → Finalizado Copy → Desenvolvendo Copy → Em Aprovação → Tráfego e RDS → Revisão → Aprovados → Reprovados → Agendamento → Agendados → Postados → Finalizados (defined in DEFAULT_KANBAN_COLUMNS). "Agendamento" is a staging column where cards wait to be scheduled; cards show an "Agendar" button with confirmation dialog that moves them to "Agendados" (confirmed scheduled). "Informações", "Próximos serviços" and "Fotos já usadas" were removed. "Voltar p/ Fila" button available on cards in Postados, Finalizados, and Agendados via dedicated endpoint `/api/kanban/cards/:id/back-to-fila`.
    - **Mandatory First Column**: All new cards are always created in "Fila" column (MANDATORY_FIRST_COLUMN). Time tracking starts automatically on creation. The "Adicionar cartão" button only appears on the Fila column.
    - **Fixed Kanban Columns**: "Agendamento", "Agendados", "Postados", "Finalizados" are fixed columns that cannot be deleted or renamed (FIXED_KANBAN_COLUMNS). All protected columns (including "Fila" and approval columns) are defined in PROTECTED_KANBAN_COLUMNS.
    - **Notification System**: Real-time notification bell in sidebar (desktop) and mobile header. Notifications triggered on: approval sent, card approved, card rejected, revision requested, comment added, card scheduled. Bell shows unread count badge. Sidebar Quadro and Posts items show notification count badges. Polling every 15s for new notifications. API: GET /api/notifications, GET /api/notifications/unread-count, PUT /api/notifications/:id/read, PUT /api/notifications/read-all.
    - **Client Activity Reports**: Third tab "Relatório por Cliente" in reports page showing comprehensive monthly activity per client: cards created, approval status breakdown, posts stats, type distribution (pie chart), platform distribution (bar chart). Filterable by client, month, year.
    - **Brand Identity Files**: File upload section in client onboarding for brand manuals, logos, typography, editable files. Files stored in Google Drive under client folder. Categories: manual, editável, logo, tipografia, paleta, geral.
    - **Error Reporting System**: Admin-only error reports page at `/error-reports` with CRUD operations, severity levels, status tracking (aberto, em_andamento, resolvido, ignorado). Any authenticated user can submit reports.
    - **Dynamic Client Logos**: Sidebar navigation shows client logos (from `logoUrl` field) or initial-letter circles next to client names in Kanban and Posts expandable lists.
    - **Multi-Select Platform Field**: Kanban card type "Post" uses multi-select checkboxes for platform selection (Instagram, Facebook, LinkedIn, TikTok, Blog). Values stored as JSON array in templateData.
    - **Custom Briefing Templates**: Admin/designer can create reusable briefing templates with custom questions. Question types: text, color-picker, file-upload. Templates tab in briefings page for CRUD. Briefings can be "brand" (fixed questions) or "custom" (template-driven). Public briefing page renders template questions with file upload support (10MB limit).
    - **System Branding Customization**: Admin-only settings page section for customizing system identity. Upload custom logo and favicon (stored in `uploads/system/`), set system name (replaces "Shift" everywhere), and select from 3 theme presets: Clássico (green, default), Business (blue/indigo corporate), Criativo (purple/pink vibrant). Theme applied via `[data-theme]` CSS attribute on `<html>`. Branding data served from public endpoint `/api/settings/branding` (no auth required for login page). Dynamic favicon and document title updated via React component. Settings stored in `system_settings` table (keys: SYSTEM_NAME, SYSTEM_LOGO, SYSTEM_FAVICON, SYSTEM_THEME).
    - **Client Link Pages (Linktree-style)**: Public pages per client at `/link/:slug` showing business info, social links, products, and services. Customizable colors (primaryColor, secondaryColor). Responsive menu with Sobre/Produtos/Serviços sections (only shown if data exists). Social links: WhatsApp, Instagram, Facebook, TikTok, LinkedIn, YouTube. Contact links: phone, email, website. Configured in onboarding "Link Page" section with slug, bio, colors, and social URLs. Copy-to-clipboard link generation for Instagram bio.

### Backend
- **Runtime**: Node.js with Express 5 and TypeScript.
- **API**: RESTful JSON API (`/api/*`) with shared route definitions and Zod schemas for type-safe communication.
- **Authentication**: Custom email/password authentication using bcrypt, with `express-session` and `connect-pg-simple` for session management.
- **Authorization**: Role-based access control (`admin`, `designer`, `client`) with optional `isManager` flag. Managers can link users to clients via `user_client_access` junction table. Enforced by server-side middleware.
- **Storage Layer**: Uses an `IStorage` interface for abstraction, implemented with Drizzle ORM.
- **Build Process**: Custom script for client (Vite) and server (esbuild) compilation.

### Database
- **ORM**: Drizzle ORM with PostgreSQL.
- **Schema**: Defines tables for `users`, `clients`, `posts`, `approval_posts`, `notifications`, `competitors`, `briefings`, `briefing_templates`, `user_client_access`, Kanban-related entities (`kanban_columns`, `kanban_cards`, etc.), onboarding entities (`client_products`, `client_services`, `client_credentials`, `client_insights`, `client_onboarding_access`), `brand_identity_files`, and `error_reports`. Kanban cards include `approvalSentAt` and `approvalResolvedAt` timestamps for workflow metrics. Briefings support `briefingType` ("brand" for fixed questions, "custom" for template-based) and `templateId` linking to `briefing_templates`.
- **Schema Push**: `drizzle-kit push` for database synchronization.

### Shared Code
- Centralized Zod schemas for Drizzle ORM table definitions (`schema.ts`) and API route contracts (`routes.ts`) to ensure type consistency across frontend and backend.

## Deployment

- **Target**: Self-hosted on Hostinger VPS (not Replit)
- **VPS IP**: 195.35.18.161
- **Domain**: kanbou.com.br
- **Guide**: See `DEPLOY.md` for full deployment instructions
- **Env Example**: See `.env.example` for required environment variables
- **Build**: `npm run build` → `dist/public/` (frontend) + `dist/index.cjs` (backend)
- **Start**: `npm start` (production) or `npm run dev` (development)
- **No Replit Dependencies**: Google Drive uses standard OAuth2 credentials, file uploads use local filesystem (`uploads/` directory), no Replit-specific services required
- **Deploy Flow**: Replit (development) → GitHub (backup at github.com/renatovsantana/kanbou) → VPS (production). Deploy script: `bash scripts/deploy.sh`
- **GitHub**: Private repo at `renatovsantana/kanbou`, branch `main`. VPS has GitHub remote configured for pull/push.

## External Dependencies

- **PostgreSQL**: Primary database for all application data.
- **Google Drive Integration**: Standard OAuth2 flow using `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`. Manages client folders with year/month organization (Client/{YYYY}/{MM}/Kanban, Client/{YYYY}/{MM}/Aprovações). File uploads use normalized filenames with date prefix (YYYY-MM-DD_HHmm_nome-do-arquivo.ext). Kanban card file attachments organized by extension subfolders. Listing functions search both legacy (direct) and new (year/month) folder structures for backward compatibility.
- **Local File Storage**: Uploads stored in `uploads/` directory (private/public). Thumbnails stored in `server/thumbnails/`. No cloud storage dependency.
- **Google Fonts**: Inter and Plus Jakarta Sans for typography.
- **bcryptjs**: For secure password hashing.
- **express-session**: Middleware for session management.
- **connect-pg-simple**: PostgreSQL session store.
- **dotenv**: Loads environment variables from `.env` file.
- **Admin Settings Page**: `/settings` route for admin-only system configuration. Google Drive OAuth2 credentials (Client ID, Client Secret, Refresh Token) can be configured directly in the UI and stored encrypted in `system_settings` table. Credentials are validated before saving. Falls back to environment variables if DB settings not present.