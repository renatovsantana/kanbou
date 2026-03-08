# Shift Agency Manager

## Overview

Shift is a social media agency management tool designed for Brazilian social media agencies. It enables management of clients and scheduling of posts across various platforms (Instagram, Facebook, LinkedIn, TikTok, Blog). Key features include a dashboard with analytics, a post scheduler with a calendar view, client management, and an approval workflow with role-based access. The project's vision is to streamline social media content management, enhance agency-client collaboration, and provide insightful performance analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Vite, Wouter.
- **UI/UX**: shadcn/ui (new-york style) with Radix UI and Tailwind CSS. Recharts for analytics, react-day-picker for calendars.
- **State Management**: TanStack React Query.
- **Forms**: React Hook Form with Zod validation.
- **Design**: Modern workspace aesthetic with orange primary color (#E05A17) and dark teal sidebar (#03222D). All user-facing text is in Brazilian Portuguese.
- **Key Features**:
    - **Kanban Approval Workflow**: Trello-like boards per client with a structured approval process (Em aprovação, Aprovados, Revisão, Reprovados). Protected columns ensure workflow integrity. Cards support details, attachments, comments, time tracking, and type-specific templates.
    - **Scheduling**: "Agendar Aprovado" feature for scheduling approved posts.
    - **Calendar System**: Comprehensive `/calendar` page with Monthly, Weekly, and List views, showing all kanban cards with dates and statuses, overdue indicators, and client/platform/status filters.
    - **Client-Specific Views**: Clients see only their relevant data (Kanban, simplified dashboard).
    - **Sidebar Navigation**: Role-aware (Admin, Designer, Client) with expandable client lists.
    - **Client Onboarding**: Comprehensive onboarding with rich text descriptions, notes, products, services, social credentials, competitors, hashtags, and user access control.
    - **Rich Text Editor**: TipTap-based editor for various content fields.
    - **Dedicated Insights Page**: Separate `/insights` page for creating and viewing client-specific insights with rich text, client filtering, and notifications.
    - **Colored Kanban Cards**: Cards are visually categorized by type using colored border strips.
    - **Overdue Scheduling Detection**: Post-type cards with past publish dates are moved to an "Agendamento Atrasado" section.
    - **Workflow Reports**: `/reports` page with "Fluxo de Trabalho" (workflow metrics, charts) and "Atividade por Usuário" (activity tracking, time per column).
    - **Production Stage Tracking**: Automatic time tracking for cards in specific production-related Kanban columns.
    - **Kanban Column Structure**: Predefined and fixed columns for managing the content workflow, including "Fila" as the mandatory first column and "Agendamento" for scheduled items. Fixed columns cannot be deleted or renamed.
    - **Notification System**: Real-time notifications for approval statuses, comments, and scheduling, displayed via a bell icon with unread counts.
    - **Client Activity Reports**: A tab in the reports page showing monthly activity per client, including card creation, approval breakdown, and post distribution.
    - **Brand Identity Files**: Upload section for client brand assets (manuals, logos, typography) stored in Google Drive.
    - **Error Reporting System**: Admin-only page for tracking and managing error reports.
    - **Dynamic Client Logos**: Client logos or initial-letter circles displayed in sidebar navigation.
    - **Multi-Select Platform Field**: Kanban card type "Post" allows multi-selection of social media platforms.
    - **Custom Briefing Templates**: Admin/designer can create reusable briefing templates with custom questions (text, color-picker, file-upload). Public briefing pages render these templates.
    - **System Branding Customization**: Admin-only settings for custom logo, favicon, system name, and theme presets (Clássico, Business, Criativo).
    - **Client Link Pages (Linktree-style)**: Public pages at `/link/:slug` for clients to display business info, social links, products, and services, with customizable colors.
    - **AI Assistant (Assistente IA)**: Slide-out panel utilizing OpenAI gpt-4o-mini with 8 specialized agent functions (e.g., client overview, content ideas, generate insight, reports, productivity analysis). Agents build context from client data.

### Backend
- **Runtime**: Node.js with Express 5 and TypeScript.
- **API**: RESTful JSON API (`/api/*`) using shared Zod schemas for type safety.
- **Authentication**: Custom email/password authentication with bcrypt, `express-session`, and `connect-pg-simple`.
- **Authorization**: Role-based access control (`admin`, `designer`, `client`) enforced by server-side middleware.
- **Storage Layer**: Drizzle ORM implementation of an `IStorage` interface.
- **Build Process**: Custom scripts for client (Vite) and server (esbuild) compilation.

### Database
- **ORM**: Drizzle ORM with PostgreSQL.
- **Schema**: Comprehensive schema defining tables for users, clients, posts, approval workflow, notifications, kanban entities, onboarding data, brand identity, and error reports. Kanban cards include timestamps for workflow metrics. Briefings support type-based differentiation and template linking.

### Shared Code
- Centralized Zod schemas for Drizzle ORM table definitions and API route contracts to ensure type consistency across frontend and backend.

## External Dependencies

- **PostgreSQL**: Main database for all application data.
- **Google Drive Integration**: For storing client files and brand identity files, utilizing OAuth2 (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`). Supports structured folder organization and legacy file listing.
- **Local File Storage**: For uploads (`uploads/`) and thumbnails (`server/thumbnails/`).
- **Google Fonts**: Inter and Plus Jakarta Sans.
- **bcryptjs**: For password hashing.
- **express-session**: For session management.
- **connect-pg-simple**: PostgreSQL session store.
- **dotenv**: For environment variable management.
- **OpenAI**: gpt-4o-mini for AI Agent functions. Uses `OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_API_KEY` env var. Handles missing key gracefully.