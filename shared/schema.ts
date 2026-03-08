import { pgTable, text, serial, timestamp, boolean, integer, varchar, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Users table schema.
 * Stores all system users including admins, designers, editors, and client users.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"),
  clientId: integer("client_id").references(() => clients.id),
  permissions: text("permissions").array(),
  isManager: boolean("is_manager").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Clients table schema.
 * Stores agency clients with their branding, social media links, and kanban configuration.
 */
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  website: text("website"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  tiktok: text("tiktok"),
  linkedin: text("linkedin"),
  youtube: text("youtube"),
  bio: text("bio"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  slug: text("slug").unique(),
  linkPageVisibility: text("link_page_visibility"),
  linkPageTheme: text("link_page_theme"),
  logoUrl: text("logo_url"),
  driveFolderId: text("drive_folder_id"),
  driveFolderUrl: text("drive_folder_url"),
  notes: text("notes"),
  about: text("about"),
  tags: text("tags").array(),
  marketTags: text("market_tags").array(),
  kanbanBgColor: text("kanban_bg_color"),
  kanbanBgImage: text("kanban_bg_image"),
  enableReuniao: boolean("enable_reuniao").default(false),
  enableCaptacao: boolean("enable_captacao").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Posts table schema.
 * Stores social media posts with scheduling, platform targeting, and approval linkage.
 */
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  clientName: text("client_name").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  platform: text("platform").array().notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  status: text("status").notNull().default("Agendado"),
  mediaUrl: text("media_url"),
  mediaUrls: text("media_urls").array(),
  approvalPostId: integer("approval_post_id"),
  kanbanCardId: integer("kanban_card_id"),
  notes: text("notes"),
  isPosted: boolean("is_posted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Approval posts table schema.
 * Stores posts sent for client approval, including versioning and Google Drive integration.
 */
export const approvalPosts = pgTable("approval_posts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  clientName: text("client_name").notNull(),
  title: text("title").notNull(),
  caption: text("caption"),
  imageUrl: text("image_url").notNull(),
  imageUrls: text("image_urls").array(),
  platform: text("platform").array(),
  status: text("status").notNull().default("Pendente"),
  observations: text("observations"),
  annotations: text("annotations"),
  captionSuggestion: text("caption_suggestion"),
  designerId: integer("designer_id").references(() => users.id),
  groupId: text("group_id"),
  parentId: integer("parent_id"),
  version: integer("version").default(1),
  driveFolderId: text("drive_folder_id"),
  driveFolderUrl: text("drive_folder_url"),
  driveFileIds: text("drive_file_ids"),
  scheduledDate: timestamp("scheduled_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Notifications table schema.
 * Stores system notifications for users, linked to approval posts or kanban cards.
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  approvalPostId: integer("approval_post_id").references(() => approvalPosts.id),
  kanbanCardId: integer("kanban_card_id"),
  type: text("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  recipientRole: text("recipient_role"),
  recipientUserId: integer("recipient_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Competitors table schema.
 * Stores competitor information for each client, including social media profiles.
 */
export const competitors = pgTable("competitors", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  instagram: text("instagram"),
  facebook: text("facebook"),
  tiktok: text("tiktok"),
  linkedin: text("linkedin"),
  youtube: text("youtube"),
  website: text("website"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === KANBAN TABLES ===

/**
 * Kanban columns table schema.
 * Stores the columns of a client's kanban board with ordering.
 */
export const kanbanColumns = pgTable("kanban_columns", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * All available kanban card types.
 * Each type represents a different kind of deliverable or workflow item.
 */
export const CARD_TYPES = [
  "geral",
  "post",
  "video",
  "material_offline",
  "material_digital",
  "copy",
  "roteiro",
  "identidade_visual",
  "reuniao",
  "captacao",
] as const;

/** Union type derived from the CARD_TYPES array. */
export type CardType = typeof CARD_TYPES[number];

/**
 * Human-readable labels for each card type (in Portuguese).
 */
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  geral: "Geral",
  post: "Post",
  video: "Vídeo",
  material_offline: "Material Offline",
  material_digital: "Material Digital",
  copy: "Copy",
  roteiro: "Roteiro",
  identidade_visual: "Identidade Visual",
  reuniao: "Reunião",
  captacao: "Captação",
};

/**
 * Tailwind CSS background color classes for each card type.
 * Used for visual distinction of cards on the kanban board.
 */
export const CARD_TYPE_COLORS: Record<CardType, string> = {
  geral: "bg-gray-500",
  post: "bg-blue-500",
  video: "bg-cyan-500",
  material_offline: "bg-amber-500",
  material_digital: "bg-purple-500",
  copy: "bg-emerald-500",
  roteiro: "bg-red-500",
  identidade_visual: "bg-pink-500",
  reuniao: "bg-orange-500",
  captacao: "bg-teal-500",
};

/**
 * Describes a single field within a card type template.
 * Used to render dynamic forms based on the selected card type.
 */
export interface CardTemplateField {
  /** Unique key identifier for the field */
  key: string;
  /** Display label for the field (in Portuguese) */
  label: string;
  /** Input type determining the form control to render */
  type: "text" | "textarea" | "date" | "select" | "multi-select";
  /** Available options for select/multi-select field types */
  options?: string[];
  /** Whether the field is required */
  required?: boolean;
}

/**
 * Template field definitions for each card type.
 * Maps each CardType to an array of form fields that are displayed
 * when creating or editing a card of that type.
 */
export const CARD_TYPE_FIELDS: Record<CardType, CardTemplateField[]> = {
  geral: [],
  post: [
    { key: "headline", label: "Headline da Imagem", type: "text" },
    { key: "postTitle", label: "Título do Post", type: "text" },
    { key: "caption", label: "Legenda", type: "textarea" },
    { key: "platform", label: "Plataformas", type: "multi-select", options: ["Instagram", "Facebook", "LinkedIn", "TikTok", "Blog"] },
    { key: "publishDate", label: "Data de Publicação", type: "date" },
    { key: "hashtags", label: "Hashtags", type: "text" },
    { key: "references", label: "Referências Visuais", type: "textarea" },
  ],
  material_offline: [
    { key: "materialTitle", label: "Título", type: "text", required: true },
    { key: "materialDesc", label: "Descrição", type: "textarea" },
    { key: "format", label: "Formato/Tamanho", type: "text" },
    { key: "quantity", label: "Quantidade", type: "text" },
    { key: "deadline", label: "Prazo de Entrega", type: "date" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  material_digital: [
    { key: "materialTitle", label: "Título", type: "text", required: true },
    { key: "materialDesc", label: "Descrição", type: "textarea" },
    { key: "digitalFormat", label: "Formato", type: "select", options: ["PDF", "Banner Web", "E-mail Marketing", "Apresentação", "E-book", "Outro"] },
    { key: "dimensions", label: "Dimensões", type: "text" },
    { key: "deadline", label: "Prazo de Entrega", type: "date" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  copy: [
    { key: "copyTitle", label: "Título", type: "text", required: true },
    { key: "textType", label: "Tipo de Texto", type: "select", options: ["Anúncio", "Artigo", "Newsletter", "Release", "Institucional", "Outro"] },
    { key: "audience", label: "Público-Alvo", type: "text" },
    { key: "tone", label: "Tom de Voz", type: "select", options: ["Formal", "Informal", "Técnico", "Descontraído", "Persuasivo", "Institucional"] },
    { key: "deadline", label: "Prazo de Entrega", type: "date" },
    { key: "briefing", label: "Briefing / Orientações", type: "textarea" },
  ],
  roteiro: [
    { key: "scriptTitle", label: "Título", type: "text", required: true },
    { key: "scriptType", label: "Tipo", type: "select", options: ["Rádio", "TV", "Vídeo Institucional", "Vídeo Redes Sociais", "Podcast", "Outro"] },
    { key: "duration", label: "Duração Prevista", type: "text" },
    { key: "deadline", label: "Prazo de Entrega", type: "date" },
    { key: "briefing", label: "Briefing / Orientações", type: "textarea" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  identidade_visual: [
    { key: "idTitle", label: "Título", type: "text", required: true },
    { key: "idType", label: "Tipo", type: "select", options: ["Logo", "Manual de Marca", "Papelaria", "Redesign", "Brandbook", "Outro"] },
    { key: "idDesc", label: "Descrição", type: "textarea" },
    { key: "references", label: "Referências Visuais", type: "textarea" },
    { key: "deadline", label: "Prazo de Entrega", type: "date" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  video: [
    { key: "videoTitle", label: "Título do Vídeo", type: "text", required: true },
    { key: "videoType", label: "Tipo de Vídeo", type: "select", options: ["Reels/Shorts", "Stories", "Feed", "Institucional", "Publicitário", "Tutorial", "Depoimento", "Outro"] },
    { key: "duration", label: "Duração Prevista", type: "text" },
    { key: "platform", label: "Plataformas", type: "multi-select", options: ["Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube", "Blog"] },
    { key: "caption", label: "Legenda", type: "textarea" },
    { key: "roteiro", label: "Roteiro / Briefing", type: "textarea" },
    { key: "format", label: "Formato", type: "select", options: ["Vertical (9:16)", "Horizontal (16:9)", "Quadrado (1:1)", "Outro"] },
    { key: "publishDate", label: "Data de Publicação", type: "date" },
    { key: "hashtags", label: "Hashtags", type: "text" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
  reuniao: [
    { key: "reuniaoTitle", label: "Título da Reunião", type: "text", required: true },
    { key: "reuniaoType", label: "Tipo", type: "select", options: ["Alinhamento", "Planejamento", "Apresentação", "Aprovação", "Brainstorm", "Outro"] },
    { key: "reuniaoDate", label: "Data da Reunião", type: "date" },
    { key: "participants", label: "Participantes", type: "text" },
    { key: "location", label: "Local / Link", type: "text" },
    { key: "agenda", label: "Pauta", type: "textarea" },
    { key: "notes", label: "Anotações", type: "textarea" },
  ],
  captacao: [
    { key: "captacaoTitle", label: "Título", type: "text", required: true },
    { key: "captacaoType", label: "Tipo de Captação", type: "select", options: ["Vídeo", "Fotografia", "Vídeo e Fotografia"] },
    { key: "captacaoDate", label: "Data da Captação", type: "date" },
    { key: "location", label: "Local", type: "text" },
    { key: "equipment", label: "Equipamentos Necessários", type: "textarea" },
    { key: "shotList", label: "Lista de Cenas / Fotos", type: "textarea" },
    { key: "references", label: "Referências Visuais", type: "textarea" },
    { key: "participants", label: "Equipe / Participantes", type: "text" },
    { key: "notes", label: "Observações", type: "textarea" },
  ],
};

/**
 * Kanban cards table schema.
 * Stores individual cards within kanban columns, supporting card types,
 * templates, checklists, attachments, and approval workflows.
 */
export const kanbanCards = pgTable("kanban_cards", {
  id: serial("id").primaryKey(),
  columnId: integer("column_id").references(() => kanbanColumns.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  dueDate: timestamp("due_date"),
  position: integer("position").notNull().default(0),
  labels: text("labels").array(),
  assignedUserIds: integer("assigned_user_ids").array(),
  attachments: text("attachments"),
  checklist: text("checklist"),
  cardType: text("card_type").default("geral"),
  templateData: text("template_data"),
  approvalStatus: text("approval_status"),
  approvalNotes: text("approval_notes"),
  approvalPostId: integer("approval_post_id").references(() => approvalPosts.id),
  approvalSentAt: timestamp("approval_sent_at"),
  approvalResolvedAt: timestamp("approval_resolved_at"),
  columnEnteredAt: timestamp("column_entered_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Kanban comments table schema.
 * Stores user comments on kanban cards.
 */
export const kanbanComments = pgTable("kanban_comments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => kanbanCards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Kanban activity log table schema.
 * Tracks card movements between columns and other actions for audit purposes.
 */
export const kanbanActivity = pgTable("kanban_activity", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => kanbanCards.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  fromColumnId: integer("from_column_id"),
  toColumnId: integer("to_column_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Kanban time entries table schema.
 * Records time tracking data for cards in timed columns.
 */
export const kanbanTimeEntries = pgTable("kanban_time_entries", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => kanbanCards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  columnId: integer("column_id").references(() => kanbanColumns.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  totalSeconds: integer("total_seconds"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Default kanban column titles created for each new client.
 * Represents the standard workflow pipeline stages.
 */
export const DEFAULT_KANBAN_COLUMNS = [
  "Fila",
  "Desenvolvendo Copy",
  "Finalizado Copy",
  "Desenvolvendo Design",
  "Revisar Criação",
  "Tráfego e RDS",
  "Em Aprovação",
  "Revisão",
  "Aprovados",
  "Agendamento",
  "Agendados",
  "Postados",
  "Finalizados",
  "Reprovados",
];

/** The first column that must always exist in every kanban board. */
export const MANDATORY_FIRST_COLUMN = "Fila";

/**
 * Conditional columns that only appear when specific client flags are enabled.
 * Maps column title to the corresponding boolean field on the client record.
 */
export const CONDITIONAL_COLUMNS = {
  "Reunião": "enableReuniao",
  "Captação": "enableCaptacao",
} as const;

/** Position index where conditional columns are inserted into the board. */
export const CONDITIONAL_COLUMN_POSITION = 1;

/**
 * Columns where automatic time tracking is active.
 * Cards entering these columns trigger time entry recording.
 */
export const TIMED_COLUMNS = [
  "Fila",
  "Desenvolvendo Design",
  "Revisar Criação",
  "Desenvolvendo Copy",
];

/**
 * Columns excluded from timer functionality.
 * Cards in these columns will not have active timers.
 */
export const TIMER_EXCLUDED_COLUMNS = [
  "Postados",
  "Finalizados",
];

/** Zod insert schema for kanban columns (excludes auto-generated fields). */
export const insertKanbanColumnSchema = createInsertSchema(kanbanColumns).omit({
  id: true,
  createdAt: true,
});

/** Zod insert schema for kanban cards with date coercion (excludes auto-generated fields). */
export const insertKanbanCardSchema = createInsertSchema(kanbanCards, {
  dueDate: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

/** Zod insert schema for kanban comments (excludes auto-generated fields). */
export const insertKanbanCommentSchema = createInsertSchema(kanbanComments).omit({
  id: true,
  createdAt: true,
});

/** Selected (read) type for a kanban column row. */
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
/** Insert type for creating a new kanban column. */
export type InsertKanbanColumn = z.infer<typeof insertKanbanColumnSchema>;

/** Selected (read) type for a kanban card row. */
export type KanbanCard = typeof kanbanCards.$inferSelect;
/** Insert type for creating a new kanban card. */
export type InsertKanbanCard = z.infer<typeof insertKanbanCardSchema>;

/** Selected (read) type for a kanban comment row. */
export type KanbanComment = typeof kanbanComments.$inferSelect;
/** Insert type for creating a new kanban comment. */
export type InsertKanbanComment = z.infer<typeof insertKanbanCommentSchema>;

/** Selected (read) type for a kanban activity log row. */
export type KanbanActivity = typeof kanbanActivity.$inferSelect;
/** Selected (read) type for a kanban time entry row. */
export type KanbanTimeEntry = typeof kanbanTimeEntries.$inferSelect;

/** Zod insert schema for users (excludes auto-generated fields). */
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

/** Zod schema for login form validation. */
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

/**
 * All available permission keys with human-readable labels and descriptions.
 * Used in the user management UI to assign granular access control.
 */
export const AVAILABLE_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", description: "Visualizar painel de controle" },
  { key: "posts_view", label: "Ver Posts", description: "Visualizar lista de posts" },
  { key: "posts_create", label: "Criar Posts", description: "Criar novos posts" },
  { key: "posts_edit", label: "Editar Posts", description: "Editar posts existentes" },
  { key: "posts_delete", label: "Excluir Posts", description: "Excluir posts" },
  { key: "calendar", label: "Calendário", description: "Visualizar calendário de agendamentos" },
  { key: "approvals_view", label: "Ver Aprovações", description: "Visualizar aprovações" },
  { key: "approvals_create", label: "Criar Aprovações", description: "Criar novas aprovações" },
  { key: "approvals_edit", label: "Editar Aprovações", description: "Editar aprovações existentes" },
  { key: "briefings_view", label: "Ver Briefings", description: "Visualizar briefings de marca" },
  { key: "briefings_manage", label: "Gerenciar Briefings", description: "Criar e excluir briefings" },
  { key: "clients_view", label: "Ver Clientes", description: "Visualizar lista de clientes" },
  { key: "clients_manage", label: "Gerenciar Clientes", description: "Criar, editar e excluir clientes" },
  { key: "users_manage", label: "Gerenciar Usuários", description: "Criar, editar e excluir usuários" },
] as const;

/** All user roles in the system. */
export const ALL_ROLES = ["admin", "designer", "redator", "gerente", "audiovisual", "atendimento", "client"] as const;
/** Union type for all user roles. */
export type UserRole = (typeof ALL_ROLES)[number];

/** Roles that belong to internal (agency) team members, excluding client role. */
export const INTERNAL_ROLES: UserRole[] = ["admin", "designer", "redator", "gerente", "audiovisual", "atendimento"];

/**
 * Human-readable labels for each user role (in Portuguese).
 */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  designer: "Designer",
  redator: "Redator",
  gerente: "Gerente",
  audiovisual: "Audiovisual",
  atendimento: "Atendimento",
  client: "Cliente",
};

/**
 * Checks whether a given role string is an internal (non-client) role.
 * @param role - The role string to check.
 * @returns True if the role belongs to an internal team member.
 */
export function isInternalRole(role: string): boolean {
  return INTERNAL_ROLES.includes(role as UserRole);
}

/**
 * Default permission sets assigned to each role upon user creation.
 * Admin role receives all permissions; other roles receive subsets.
 */
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: AVAILABLE_PERMISSIONS.map(p => p.key),
  designer: ["dashboard", "posts_view", "posts_create", "posts_edit", "calendar", "approvals_view", "approvals_create", "approvals_edit", "briefings_view", "briefings_manage"],
  redator: ["dashboard", "posts_view", "posts_create", "posts_edit", "calendar", "approvals_view", "approvals_create", "approvals_edit", "briefings_view", "briefings_manage"],
  gerente: ["dashboard", "posts_view", "posts_create", "posts_edit", "calendar", "approvals_view", "approvals_create", "approvals_edit", "briefings_view", "briefings_manage", "clients_view", "clients_manage"],
  audiovisual: ["dashboard", "posts_view", "posts_create", "posts_edit", "calendar", "approvals_view", "approvals_create", "approvals_edit", "briefings_view"],
  atendimento: ["dashboard", "posts_view", "posts_create", "posts_edit", "calendar", "approvals_view", "approvals_create", "approvals_edit", "briefings_view", "briefings_manage", "clients_view"],
  client: ["dashboard", "approvals_view", "briefings_view"],
};

/** Zod schema for user registration form validation. */
export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.enum(ALL_ROLES),
  clientId: z.number().nullable().optional(),
  permissions: z.array(z.string()).nullable().optional(),
  isManager: z.boolean().optional(),
});

/**
 * User-client access table schema.
 * Maps which internal users have access to which clients (many-to-many).
 */
export const userClientAccess = pgTable("user_client_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Zod insert schema for user-client access (excludes auto-generated fields). */
export const insertUserClientAccessSchema = createInsertSchema(userClientAccess).omit({
  id: true,
  createdAt: true,
});

/** Selected (read) type for a user-client access row. */
export type UserClientAccess = typeof userClientAccess.$inferSelect;
/** Insert type for creating a new user-client access mapping. */
export type InsertUserClientAccess = z.infer<typeof insertUserClientAccessSchema>;

/** Zod insert schema for clients (excludes auto-generated fields). */
export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

/** Zod insert schema for posts with date coercion (excludes auto-generated fields). */
export const insertPostSchema = createInsertSchema(posts, {
  scheduledDate: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
  isPosted: true,
});

/** Zod insert schema for approval posts with optional date coercion (excludes auto-generated fields). */
export const insertApprovalPostSchema = createInsertSchema(approvalPosts, {
  scheduledDate: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

/** Selected (read) type for a user row. */
export type User = typeof users.$inferSelect;
/** Insert type for creating a new user. */
export type InsertUser = z.infer<typeof insertUserSchema>;

/** Selected (read) type for a client row. */
export type Client = typeof clients.$inferSelect;
/** Insert type for creating a new client. */
export type InsertClient = z.infer<typeof insertClientSchema>;
/** Request type alias for creating a client. */
export type CreateClientRequest = InsertClient;
/** Request type alias for partially updating a client. */
export type UpdateClientRequest = Partial<InsertClient>;

/** Selected (read) type for a post row. */
export type Post = typeof posts.$inferSelect;
/** Insert type for creating a new post. */
export type InsertPost = z.infer<typeof insertPostSchema>;
/** Request type alias for creating a post. */
export type CreatePostRequest = InsertPost;
/** Request type alias for partially updating a post. */
export type UpdatePostRequest = Partial<InsertPost>;

/** Selected (read) type for an approval post row. */
export type ApprovalPost = typeof approvalPosts.$inferSelect;
/** Insert type for creating a new approval post. */
export type InsertApprovalPost = z.infer<typeof insertApprovalPostSchema>;
/** Request type alias for partially updating an approval post. */
export type UpdateApprovalPostRequest = Partial<InsertApprovalPost>;

/** Zod insert schema for notifications (excludes auto-generated fields). */
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

/** Selected (read) type for a notification row. */
export type Notification = typeof notifications.$inferSelect;
/** Insert type for creating a new notification. */
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

/**
 * Briefing templates table schema.
 * Stores reusable questionnaire templates for brand briefings.
 */
export const briefingTemplates = pgTable("briefing_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  questions: text("questions").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Zod insert schema for briefing templates (excludes auto-generated fields). */
export const insertBriefingTemplateSchema = createInsertSchema(briefingTemplates).omit({
  id: true,
  createdAt: true,
});

/** Selected (read) type for a briefing template row. */
export type BriefingTemplate = typeof briefingTemplates.$inferSelect;
/** Insert type for creating a new briefing template. */
export type InsertBriefingTemplate = z.infer<typeof insertBriefingTemplateSchema>;

/**
 * Describes a single question within a briefing template.
 */
export interface BriefingTemplateQuestion {
  /** Unique identifier for the question */
  id: string;
  /** The question text displayed to the user */
  text: string;
  /** Input type for the question answer */
  type: "text" | "color-picker" | "file-upload";
  /** Whether the question must be answered */
  required: boolean;
}

/**
 * Briefings table schema.
 * Stores briefing instances sent to clients, with token-based public access.
 */
export const briefings = pgTable("briefings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  clientName: text("client_name").notNull(),
  title: text("title").notNull().default("Briefing de Marca"),
  briefingType: text("briefing_type").notNull().default("brand"),
  templateId: integer("template_id").references(() => briefingTemplates.id),
  status: text("status").notNull().default("Pendente"),
  token: text("token").notNull().unique(),
  answers: text("answers"),
  createdBy: integer("created_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Zod insert schema for competitors (excludes auto-generated fields). */
export const insertCompetitorSchema = createInsertSchema(competitors).omit({
  id: true,
  createdAt: true,
});

/** Selected (read) type for a competitor row. */
export type Competitor = typeof competitors.$inferSelect;
/** Insert type for creating a new competitor. */
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;

/** Zod insert schema for briefings (excludes auto-generated and completion fields). */
export const insertBriefingSchema = createInsertSchema(briefings).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

/** Selected (read) type for a briefing row. */
export type Briefing = typeof briefings.$inferSelect;
/** Insert type for creating a new briefing. */
export type InsertBriefing = z.infer<typeof insertBriefingSchema>;

/**
 * Maps approval status values to the corresponding kanban column title.
 * Used to automatically move cards when approval status changes.
 */
export const APPROVAL_STATUS_TO_COLUMN: Record<string, string> = {
  "Pendente": "Em Aprovação",
  "Aprovado": "Aprovados",
  "Reprovado": "Reprovados",
  "Revisão": "Revisão",
  "Revisado": "Em Aprovação",
  "Refeito": "Em Aprovação",
};

/** Kanban columns that are protected and cannot be deleted or renamed. */
export const PROTECTED_KANBAN_COLUMNS = [...DEFAULT_KANBAN_COLUMNS];

/** Kanban columns that have fixed positions in the board. */
export const FIXED_KANBAN_COLUMNS = [...DEFAULT_KANBAN_COLUMNS];

/**
 * Client products table schema.
 * Stores products offered by a client for reference in content creation.
 */
export const clientProducts = pgTable("client_products", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Client services table schema.
 * Stores services offered by a client for reference in content creation.
 */
export const clientServices = pgTable("client_services", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Client custom links table schema.
 * Stores custom links displayed on the client's public link page.
 */
export const clientCustomLinks = pgTable("client_custom_links", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  icon: text("icon").notNull().default("link"),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Client credentials table schema.
 * Stores platform login credentials for a client's social media accounts.
 */
export const clientCredentials = pgTable("client_credentials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  platform: text("platform").notNull(),
  username: text("username"),
  password: text("credential_password"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Client insights table schema.
 * Stores user-submitted insights and notes about a client.
 */
export const clientInsights = pgTable("client_insights", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Client onboarding access table schema.
 * Tracks which users have access to a client's onboarding flow.
 */
export const clientOnboardingAccess = pgTable("client_onboarding_access", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Client text templates table schema.
 * Stores reusable text templates (e.g., caption templates) for a client.
 */
export const clientTextTemplates = pgTable("client_text_templates", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Zod insert schema for client products (excludes auto-generated fields). */
export const insertClientProductSchema = createInsertSchema(clientProducts).omit({ id: true, createdAt: true });
/** Zod insert schema for client services (excludes auto-generated fields). */
export const insertClientServiceSchema = createInsertSchema(clientServices).omit({ id: true, createdAt: true });
/** Zod insert schema for client credentials (excludes auto-generated fields). */
export const insertClientCredentialSchema = createInsertSchema(clientCredentials).omit({ id: true, createdAt: true });
/** Zod insert schema for client insights (excludes auto-generated fields). */
export const insertClientInsightSchema = createInsertSchema(clientInsights).omit({ id: true, createdAt: true });
/** Zod insert schema for client onboarding access (excludes auto-generated fields). */
export const insertClientOnboardingAccessSchema = createInsertSchema(clientOnboardingAccess).omit({ id: true, createdAt: true });
/** Zod insert schema for client text templates (excludes auto-generated fields). */
export const insertClientTextTemplateSchema = createInsertSchema(clientTextTemplates).omit({ id: true, createdAt: true });

/** Selected (read) type for a client custom link row. */
export type ClientCustomLink = typeof clientCustomLinks.$inferSelect;
/** Insert type for creating a new client custom link. */
export type InsertClientCustomLink = typeof clientCustomLinks.$inferInsert;

/** Selected (read) type for a client product row. */
export type ClientProduct = typeof clientProducts.$inferSelect;
/** Insert type for creating a new client product. */
export type InsertClientProduct = z.infer<typeof insertClientProductSchema>;

/** Selected (read) type for a client service row. */
export type ClientService = typeof clientServices.$inferSelect;
/** Insert type for creating a new client service. */
export type InsertClientService = z.infer<typeof insertClientServiceSchema>;

/** Selected (read) type for a client credential row. */
export type ClientCredential = typeof clientCredentials.$inferSelect;
/** Insert type for creating a new client credential. */
export type InsertClientCredential = z.infer<typeof insertClientCredentialSchema>;

/** Selected (read) type for a client insight row. */
export type ClientInsight = typeof clientInsights.$inferSelect;
/** Insert type for creating a new client insight. */
export type InsertClientInsight = z.infer<typeof insertClientInsightSchema>;

/** Selected (read) type for a client onboarding access row. */
export type ClientOnboardingAccess = typeof clientOnboardingAccess.$inferSelect;
/** Insert type for creating a new client onboarding access mapping. */
export type InsertClientOnboardingAccess = z.infer<typeof insertClientOnboardingAccessSchema>;

/** Selected (read) type for a client text template row. */
export type ClientTextTemplate = typeof clientTextTemplates.$inferSelect;
/** Insert type for creating a new client text template. */
export type InsertClientTextTemplate = z.infer<typeof insertClientTextTemplateSchema>;

/**
 * Tailwind CSS left-border color classes for each card type.
 * Used to visually distinguish card types on the kanban board with a colored left border.
 */
export const CARD_TYPE_BORDER_COLORS: Record<CardType, string> = {
  geral: "border-l-gray-400 dark:border-l-gray-500",
  post: "border-l-blue-500 dark:border-l-blue-400",
  video: "border-l-cyan-500 dark:border-l-cyan-400",
  material_offline: "border-l-amber-500 dark:border-l-amber-400",
  material_digital: "border-l-purple-500 dark:border-l-purple-400",
  copy: "border-l-emerald-500 dark:border-l-emerald-400",
  roteiro: "border-l-red-500 dark:border-l-red-400",
  identidade_visual: "border-l-pink-500 dark:border-l-pink-400",
  reuniao: "border-l-orange-500 dark:border-l-orange-400",
  captacao: "border-l-teal-500 dark:border-l-teal-400",
};

// === BRAND IDENTITY FILES ===

/**
 * Brand identity files table schema.
 * Stores uploaded brand assets (logos, guidelines, etc.) linked to Google Drive.
 */
export const brandIdentityFiles = pgTable("brand_identity_files", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  driveFileId: text("drive_file_id"),
  driveUrl: text("drive_url"),
  category: text("category").default("geral"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Zod insert schema for brand identity files (excludes auto-generated fields). */
export const insertBrandIdentityFileSchema = createInsertSchema(brandIdentityFiles).omit({
  id: true,
  createdAt: true,
});

/** Selected (read) type for a brand identity file row. */
export type BrandIdentityFile = typeof brandIdentityFiles.$inferSelect;
/** Insert type for creating a new brand identity file. */
export type InsertBrandIdentityFile = z.infer<typeof insertBrandIdentityFileSchema>;

// === ERROR REPORTS ===

/**
 * Error reports table schema.
 * Stores user-submitted bug reports and system-captured errors with resolution tracking.
 */
export const errorReports = pgTable("error_reports", {
  id: serial("id").primaryKey(),
  reporterUserId: integer("reporter_user_id").references(() => users.id),
  route: text("route"),
  menu: text("menu"),
  description: text("description").notNull(),
  severity: text("severity").default("medium"),
  errorType: text("error_type").default("user_report"),
  stack: text("stack"),
  userAgent: text("user_agent"),
  status: text("status").default("aberto"),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** Zod insert schema for error reports (excludes auto-generated and resolution fields). */
export const insertErrorReportSchema = createInsertSchema(errorReports).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

/** Selected (read) type for an error report row. */
export type ErrorReport = typeof errorReports.$inferSelect;
/** Insert type for creating a new error report. */
export type InsertErrorReport = z.infer<typeof insertErrorReportSchema>;

// === SYSTEM SETTINGS ===

/**
 * System settings table schema.
 * Stores key-value configuration pairs for application-wide settings.
 */
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Selected (read) type for a system setting row. */
export type SystemSetting = typeof systemSettings.$inferSelect;

// === SESSION TABLE (connect-pg-simple) ===

/**
 * Session table schema for express-session with connect-pg-simple.
 * Stores serialized session data with expiration tracking.
 */
export const sessionTable = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire),
]);
