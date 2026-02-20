import { pgTable, text, serial, timestamp, boolean, integer, varchar, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  clientName: text("client_name").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  platform: text("platform").array().notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  status: text("status").notNull().default("Rascunho"),
  mediaUrl: text("media_url"),
  mediaUrls: text("media_urls").array(),
  approvalPostId: integer("approval_post_id"),
  kanbanCardId: integer("kanban_card_id"),
  notes: text("notes"),
  isPosted: boolean("is_posted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  approvalPostId: integer("approval_post_id").references(() => approvalPosts.id),
  type: text("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  recipientRole: text("recipient_role"),
  recipientUserId: integer("recipient_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const kanbanColumns = pgTable("kanban_columns", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const CARD_TYPES = [
  "geral",
  "post",
  "material_offline",
  "material_digital",
  "copy",
  "roteiro",
  "identidade_visual",
] as const;

export type CardType = typeof CARD_TYPES[number];

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  geral: "Geral",
  post: "Post",
  material_offline: "Material Offline",
  material_digital: "Material Digital",
  copy: "Copy",
  roteiro: "Roteiro",
  identidade_visual: "Identidade Visual",
};

export const CARD_TYPE_COLORS: Record<CardType, string> = {
  geral: "bg-gray-500",
  post: "bg-blue-500",
  material_offline: "bg-amber-500",
  material_digital: "bg-purple-500",
  copy: "bg-emerald-500",
  roteiro: "bg-red-500",
  identidade_visual: "bg-pink-500",
};

export interface CardTemplateField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "select" | "multi-select";
  options?: string[];
  required?: boolean;
}

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
};

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
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kanbanComments = pgTable("kanban_comments", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => kanbanCards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

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

export const kanbanTimeEntries = pgTable("kanban_time_entries", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => kanbanCards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  totalSeconds: integer("total_seconds"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const DEFAULT_KANBAN_COLUMNS = [
  "Informações",
  "Próximos serviços",
  "Fila",
  "Desenvolvendo Design",
  "Desenvolvendo Copy",
  "Em Aprovação",
  "Tráfego e RDS",
  "Revisão",
  "Aprovados",
  "Reprovados",
  "Agendados",
  "Postados",
  "Finalizados",
  "Fotos já usadas",
];

export const TIMED_COLUMNS = [
  "Fila",
  "Desenvolvendo Design",
  "Desenvolvendo Copy",
];

export const insertKanbanColumnSchema = createInsertSchema(kanbanColumns).omit({
  id: true,
  createdAt: true,
});

export const insertKanbanCardSchema = createInsertSchema(kanbanCards, {
  dueDate: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertKanbanCommentSchema = createInsertSchema(kanbanComments).omit({
  id: true,
  createdAt: true,
});

export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type InsertKanbanColumn = z.infer<typeof insertKanbanColumnSchema>;

export type KanbanCard = typeof kanbanCards.$inferSelect;
export type InsertKanbanCard = z.infer<typeof insertKanbanCardSchema>;

export type KanbanComment = typeof kanbanComments.$inferSelect;
export type InsertKanbanComment = z.infer<typeof insertKanbanCommentSchema>;

export type KanbanActivity = typeof kanbanActivity.$inferSelect;
export type KanbanTimeEntry = typeof kanbanTimeEntries.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

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

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: AVAILABLE_PERMISSIONS.map(p => p.key),
  designer: ["dashboard", "posts_view", "posts_create", "posts_edit", "calendar", "approvals_view", "approvals_create", "approvals_edit", "briefings_view", "briefings_manage"],
  client: ["dashboard", "approvals_view", "briefings_view"],
};

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.enum(["admin", "designer", "client"]),
  clientId: z.number().nullable().optional(),
  permissions: z.array(z.string()).nullable().optional(),
  isManager: z.boolean().optional(),
});

export const userClientAccess = pgTable("user_client_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserClientAccessSchema = createInsertSchema(userClientAccess).omit({
  id: true,
  createdAt: true,
});

export type UserClientAccess = typeof userClientAccess.$inferSelect;
export type InsertUserClientAccess = z.infer<typeof insertUserClientAccessSchema>;

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertPostSchema = createInsertSchema(posts, {
  scheduledDate: z.coerce.date(),
}).omit({
  id: true,
  createdAt: true,
  isPosted: true,
});

export const insertApprovalPostSchema = createInsertSchema(approvalPosts, {
  scheduledDate: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type CreateClientRequest = InsertClient;
export type UpdateClientRequest = Partial<InsertClient>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type CreatePostRequest = InsertPost;
export type UpdatePostRequest = Partial<InsertPost>;

export type ApprovalPost = typeof approvalPosts.$inferSelect;
export type InsertApprovalPost = z.infer<typeof insertApprovalPostSchema>;
export type UpdateApprovalPostRequest = Partial<InsertApprovalPost>;

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const briefingTemplates = pgTable("briefing_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  questions: text("questions").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBriefingTemplateSchema = createInsertSchema(briefingTemplates).omit({
  id: true,
  createdAt: true,
});

export type BriefingTemplate = typeof briefingTemplates.$inferSelect;
export type InsertBriefingTemplate = z.infer<typeof insertBriefingTemplateSchema>;

export interface BriefingTemplateQuestion {
  id: string;
  text: string;
  type: "text" | "color-picker" | "file-upload";
  required: boolean;
}

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

export const insertCompetitorSchema = createInsertSchema(competitors).omit({
  id: true,
  createdAt: true,
});

export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;

export const insertBriefingSchema = createInsertSchema(briefings).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type Briefing = typeof briefings.$inferSelect;
export type InsertBriefing = z.infer<typeof insertBriefingSchema>;

export const APPROVAL_STATUS_TO_COLUMN: Record<string, string> = {
  "Pendente": "Em Aprovação",
  "Aprovado": "Aprovados",
  "Reprovado": "Reprovados",
  "Revisão": "Revisão",
  "Revisado": "Em Aprovação",
  "Refeito": "Em Aprovação",
};

export const PROTECTED_KANBAN_COLUMNS = ["Em Aprovação", "Aprovados", "Reprovados", "Revisão", "Agendados", "Postados", "Finalizados"];

export const FIXED_KANBAN_COLUMNS = ["Em Aprovação", "Aprovados", "Reprovados", "Revisão", "Agendados", "Postados", "Finalizados"];

export const clientProducts = pgTable("client_products", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientServices = pgTable("client_services", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientCustomLinks = pgTable("client_custom_links", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  icon: text("icon").notNull().default("link"),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientCredentials = pgTable("client_credentials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  platform: text("platform").notNull(),
  username: text("username"),
  password: text("credential_password"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientInsights = pgTable("client_insights", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientOnboardingAccess = pgTable("client_onboarding_access", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientProductSchema = createInsertSchema(clientProducts).omit({ id: true, createdAt: true });
export const insertClientServiceSchema = createInsertSchema(clientServices).omit({ id: true, createdAt: true });
export const insertClientCredentialSchema = createInsertSchema(clientCredentials).omit({ id: true, createdAt: true });
export const insertClientInsightSchema = createInsertSchema(clientInsights).omit({ id: true, createdAt: true });
export const insertClientOnboardingAccessSchema = createInsertSchema(clientOnboardingAccess).omit({ id: true, createdAt: true });

export type ClientCustomLink = typeof clientCustomLinks.$inferSelect;
export type InsertClientCustomLink = typeof clientCustomLinks.$inferInsert;

export type ClientProduct = typeof clientProducts.$inferSelect;
export type InsertClientProduct = z.infer<typeof insertClientProductSchema>;

export type ClientService = typeof clientServices.$inferSelect;
export type InsertClientService = z.infer<typeof insertClientServiceSchema>;

export type ClientCredential = typeof clientCredentials.$inferSelect;
export type InsertClientCredential = z.infer<typeof insertClientCredentialSchema>;

export type ClientInsight = typeof clientInsights.$inferSelect;
export type InsertClientInsight = z.infer<typeof insertClientInsightSchema>;

export type ClientOnboardingAccess = typeof clientOnboardingAccess.$inferSelect;
export type InsertClientOnboardingAccess = z.infer<typeof insertClientOnboardingAccessSchema>;

export const CARD_TYPE_BORDER_COLORS: Record<CardType, string> = {
  geral: "border-l-gray-400 dark:border-l-gray-500",
  post: "border-l-blue-500 dark:border-l-blue-400",
  material_offline: "border-l-amber-500 dark:border-l-amber-400",
  material_digital: "border-l-purple-500 dark:border-l-purple-400",
  copy: "border-l-emerald-500 dark:border-l-emerald-400",
  roteiro: "border-l-red-500 dark:border-l-red-400",
  identidade_visual: "border-l-pink-500 dark:border-l-pink-400",
};

// === BRAND IDENTITY FILES ===

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

export const insertBrandIdentityFileSchema = createInsertSchema(brandIdentityFiles).omit({
  id: true,
  createdAt: true,
});

export type BrandIdentityFile = typeof brandIdentityFiles.$inferSelect;
export type InsertBrandIdentityFile = z.infer<typeof insertBrandIdentityFileSchema>;

// === ERROR REPORTS ===

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

export const insertErrorReportSchema = createInsertSchema(errorReports).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export type ErrorReport = typeof errorReports.$inferSelect;
export type InsertErrorReport = z.infer<typeof insertErrorReportSchema>;

// === SYSTEM SETTINGS ===

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

// === SESSION TABLE (connect-pg-simple) ===

export const sessionTable = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire),
]);
