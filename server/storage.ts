/**
 * @module server/storage
 * Camada de acesso a dados (Data Access Layer) da aplicação.
 * Define a interface IStorage com todos os métodos CRUD necessários
 * e implementa DatabaseStorage usando Drizzle ORM com PostgreSQL.
 */

import { db } from "./db";
import {
  users,
  posts,
  clients,
  approvalPosts,
  notifications,
  competitors,
  briefings,
  kanbanColumns,
  kanbanCards,
  kanbanComments,
  kanbanActivity,
  kanbanTimeEntries,
  userClientAccess,
  clientProducts,
  clientServices,
  clientCredentials,
  clientInsights,
  clientOnboardingAccess,
  type InsertUser,
  type User,
  type InsertPost,
  type UpdatePostRequest,
  type Post,
  type InsertClient,
  type UpdateClientRequest,
  type Client,
  type InsertApprovalPost,
  type UpdateApprovalPostRequest,
  type ApprovalPost,
  type InsertNotification,
  type Notification,
  type InsertCompetitor,
  type Competitor,
  type InsertBriefing,
  type Briefing,
  type KanbanColumn,
  type InsertKanbanColumn,
  type KanbanCard,
  type InsertKanbanCard,
  type KanbanComment,
  type InsertKanbanComment,
  type KanbanActivity,
  type KanbanTimeEntry,
  type UserClientAccess,
  type ClientProduct,
  type InsertClientProduct,
  type ClientService,
  type InsertClientService,
  type ClientCredential,
  type InsertClientCredential,
  type ClientInsight,
  type InsertClientInsight,
  type ClientOnboardingAccess,
  clientCustomLinks,
  type ClientCustomLink,
  type InsertClientCustomLink,
  clientTextTemplates,
  type ClientTextTemplate,
  type InsertClientTextTemplate,
  briefingTemplates,
  brandIdentityFiles,
  errorReports,
  systemSettings,
  type BriefingTemplate,
  type InsertBriefingTemplate,
  type BrandIdentityFile,
  type InsertBrandIdentityFile,
  type ErrorReport,
  type InsertErrorReport,
  type SystemSetting,
} from "@shared/schema";
import { eq, desc, and, or, asc, isNull, gte, lte, sql, arrayContains, inArray } from "drizzle-orm";

/**
 * Interface de armazenamento que define todos os métodos CRUD da aplicação.
 * Serve como contrato para implementações de acesso a dados, permitindo
 * trocar a camada de persistência sem afetar o restante da aplicação.
 */
export interface IStorage {
  /** Busca um usuário pelo ID */
  getUser(id: number): Promise<User | undefined>;
  /** Busca um usuário pelo e-mail */
  getUserByEmail(email: string): Promise<User | undefined>;
  /** Cria um novo usuário */
  createUser(user: InsertUser): Promise<User>;
  /** Lista todos os usuários ordenados por data de criação (desc) */
  getUsers(): Promise<User[]>;
  /** Atualiza campos de um usuário existente */
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  /** Remove um usuário e limpa todas as referências relacionadas */
  deleteUser(id: number): Promise<void>;

  /** Lista todos os clientes ordenados por data de criação (desc) */
  getClients(): Promise<Client[]>;
  /** Busca um cliente pelo ID */
  getClient(id: number): Promise<Client | undefined>;
  /** Busca um cliente pelo slug (URL amigável) */
  getClientBySlug(slug: string): Promise<Client | undefined>;
  /** Cria um novo cliente */
  createClient(client: InsertClient): Promise<Client>;
  /** Atualiza campos de um cliente existente */
  updateClient(id: number, updates: UpdateClientRequest): Promise<Client>;
  /** Remove um cliente */
  deleteClient(id: number): Promise<void>;

  /** Lista links personalizados de um cliente, ordenados por posição */
  getClientCustomLinks(clientId: number): Promise<ClientCustomLink[]>;
  /** Busca um link personalizado pelo ID */
  getClientCustomLink(id: number): Promise<ClientCustomLink | undefined>;
  /** Cria um novo link personalizado para um cliente */
  createClientCustomLink(link: InsertClientCustomLink): Promise<ClientCustomLink>;
  /** Atualiza um link personalizado existente */
  updateClientCustomLink(id: number, updates: Partial<InsertClientCustomLink>): Promise<ClientCustomLink>;
  /** Remove um link personalizado */
  deleteClientCustomLink(id: number): Promise<void>;

  /** Lista todos os posts ordenados por data de agendamento (desc) */
  getPosts(): Promise<Post[]>;
  /** Busca um post pelo ID */
  getPost(id: number): Promise<Post | undefined>;
  /** Lista posts de um cliente específico */
  getPostsByClient(clientId: number): Promise<Post[]>;
  /** Cria um novo post */
  createPost(post: InsertPost): Promise<Post>;
  /** Atualiza campos de um post existente */
  updatePost(id: number, updates: UpdatePostRequest): Promise<Post>;
  /** Remove um post */
  deletePost(id: number): Promise<void>;

  /** Lista todos os posts de aprovação ordenados por data de criação (desc) */
  getApprovalPosts(): Promise<ApprovalPost[]>;
  /** Busca um post de aprovação pelo ID */
  getApprovalPost(id: number): Promise<ApprovalPost | undefined>;
  /** Lista posts de aprovação de um cliente */
  getApprovalPostsByClient(clientId: number): Promise<ApprovalPost[]>;
  /** Lista posts de aprovação atribuídos a um designer */
  getApprovalPostsByDesigner(designerId: number): Promise<ApprovalPost[]>;
  /** Cria um novo post de aprovação */
  createApprovalPost(post: InsertApprovalPost): Promise<ApprovalPost>;
  /** Atualiza campos de um post de aprovação */
  updateApprovalPost(id: number, updates: UpdateApprovalPostRequest): Promise<ApprovalPost>;
  /** Remove um post de aprovação */
  deleteApprovalPost(id: number): Promise<void>;

  /** Lista notificações, opcionalmente filtradas por usuário destinatário */
  getNotifications(recipientUserId?: number): Promise<Notification[]>;
  /** Lista notificações de um cliente específico */
  getNotificationsByClient(clientId: number): Promise<Notification[]>;
  /** Cria uma nova notificação */
  createNotification(notification: InsertNotification): Promise<Notification>;
  /** Marca uma notificação como lida */
  markNotificationRead(id: number): Promise<Notification>;
  /** Marca todas as notificações não lidas como lidas, filtradas por role e opcionalmente por cliente */
  markAllNotificationsRead(role: string, clientId?: number): Promise<void>;
  /** Marca notificações de insight como lidas, filtradas por role */
  markInsightNotificationsRead(role: string, clientId?: number): Promise<void>;
  /** Marca notificações do kanban como lidas, filtradas por role */
  markKanbanNotificationsRead(role: string, clientId?: number): Promise<void>;
  /** Marca notificações de um card específico do kanban como lidas */
  markCardNotificationsRead(kanbanCardId: number, role: string, clientId?: number): Promise<void>;

  /** Lista todos os competidores */
  getCompetitors(): Promise<Competitor[]>;
  /** Lista competidores de um cliente */
  getCompetitorsByClient(clientId: number): Promise<Competitor[]>;
  /** Busca um competidor pelo ID */
  getCompetitor(id: number): Promise<Competitor | undefined>;
  /** Cria um novo competidor */
  createCompetitor(competitor: InsertCompetitor): Promise<Competitor>;
  /** Atualiza campos de um competidor */
  updateCompetitor(id: number, updates: Partial<InsertCompetitor>): Promise<Competitor>;
  /** Remove um competidor */
  deleteCompetitor(id: number): Promise<void>;

  /** Lista todos os briefings */
  getBriefings(): Promise<Briefing[]>;
  /** Lista briefings de um cliente */
  getBriefingsByClient(clientId: number): Promise<Briefing[]>;
  /** Busca um briefing pelo ID */
  getBriefing(id: number): Promise<Briefing | undefined>;
  /** Busca um briefing pelo token público (para acesso sem autenticação) */
  getBriefingByToken(token: string): Promise<Briefing | undefined>;
  /** Cria um novo briefing */
  createBriefing(briefing: InsertBriefing): Promise<Briefing>;
  /** Atualiza campos de um briefing */
  updateBriefing(id: number, updates: Partial<InsertBriefing>): Promise<Briefing>;
  /** Remove um briefing */
  deleteBriefing(id: number): Promise<void>;

  /** Lista colunas do kanban de um cliente, ordenadas por posição */
  getKanbanColumnsByClient(clientId: number): Promise<KanbanColumn[]>;
  /** Busca uma coluna do kanban pelo ID */
  getKanbanColumn(id: number): Promise<KanbanColumn | undefined>;
  /** Cria uma nova coluna do kanban */
  createKanbanColumn(col: InsertKanbanColumn): Promise<KanbanColumn>;
  /** Atualiza campos de uma coluna do kanban */
  updateKanbanColumn(id: number, updates: Partial<InsertKanbanColumn>): Promise<KanbanColumn>;
  /** Remove uma coluna e todos os cards dentro dela */
  deleteKanbanColumn(id: number): Promise<void>;
  /** Reordena colunas do kanban de um cliente pela lista de IDs */
  reorderKanbanColumns(clientId: number, columnIds: number[]): Promise<void>;

  /** Lista cards de uma coluna do kanban, ordenados por posição */
  getKanbanCardsByColumn(columnId: number): Promise<KanbanCard[]>;
  /** Lista todos os cards de um cliente */
  getKanbanCardsByClient(clientId: number): Promise<KanbanCard[]>;
  /** Busca um card do kanban pelo ID */
  getKanbanCard(id: number): Promise<KanbanCard | undefined>;
  /** Cria um novo card no kanban */
  createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard>;
  /** Atualiza campos de um card do kanban */
  updateKanbanCard(id: number, updates: Partial<InsertKanbanCard>): Promise<KanbanCard>;
  /** Remove um card e seus comentários, atividades e time entries associados */
  deleteKanbanCard(id: number): Promise<void>;
  /** Move um card para outra coluna e posição, atualizando columnEnteredAt se a coluna mudou */
  moveKanbanCard(cardId: number, toColumnId: number, newPosition: number): Promise<KanbanCard>;

  /** Lista comentários de um card, ordenados por data de criação (desc) */
  getKanbanComments(cardId: number): Promise<KanbanComment[]>;
  /** Cria um novo comentário em um card */
  createKanbanComment(comment: InsertKanbanComment): Promise<KanbanComment>;
  /** Remove um comentário */
  deleteKanbanComment(id: number): Promise<void>;

  /** Lista cards com status de aprovação "Aprovado" */
  getApprovedKanbanCards(): Promise<KanbanCard[]>;
  /** Lista cards nas colunas "Agendados" ou "Postados" com o título da coluna */
  getScheduledKanbanCards(): Promise<{ card: KanbanCard; columnTitle: string }[]>;
  /** Lista atividades (histórico de movimentações) de um card */
  getKanbanActivity(cardId: number): Promise<KanbanActivity[]>;
  /** Registra uma nova atividade de movimentação no kanban */
  createKanbanActivity(activity: { cardId: number; userId: number | null; action: string; fromColumnId?: number; toColumnId?: number; details?: string }): Promise<KanbanActivity>;
  /** Gera dados de relatório de movimentação do kanban com filtros opcionais */
  getMovementReportData(filters?: { clientId?: number; userId?: number; startDate?: Date; endDate?: Date }): Promise<any>;

  /** Lista time entries (registros de tempo) de um card */
  getKanbanTimeEntries(cardId: number): Promise<KanbanTimeEntry[]>;
  /** Lista time entries de múltiplos cards por IDs */
  getKanbanTimeEntriesByCardIds(cardIds: number[]): Promise<KanbanTimeEntry[]>;
  /** Busca time entry em aberto (sem endedAt) de um card */
  getOpenTimeEntry(cardId: number): Promise<KanbanTimeEntry | undefined>;
  /** Inicia um novo registro de tempo em um card */
  startTimeEntry(cardId: number, userId: number, columnId?: number): Promise<KanbanTimeEntry>;
  /** Finaliza um registro de tempo, calculando totalSeconds */
  stopTimeEntry(entryId: number): Promise<KanbanTimeEntry>;
  /** Lista time entries de um usuário com filtros opcionais de data */
  getTimeEntriesByUser(userId: number, startDate?: Date, endDate?: Date): Promise<KanbanTimeEntry[]>;

  /** Lista acessos de um usuário a clientes */
  getUserClientAccess(userId: number): Promise<UserClientAccess[]>;
  /** Lista usuários com acesso a um cliente */
  getClientAccessUsers(clientId: number): Promise<UserClientAccess[]>;
  /** Concede acesso de um usuário a um cliente (idempotente) */
  grantClientAccess(userId: number, clientId: number): Promise<UserClientAccess>;
  /** Revoga acesso de um usuário a um cliente */
  revokeClientAccess(userId: number, clientId: number): Promise<void>;
  /** Revoga todos os acessos a clientes de um usuário */
  revokeAllClientAccess(userId: number): Promise<void>;

  /** Lista produtos de um cliente */
  getClientProducts(clientId: number): Promise<ClientProduct[]>;
  /** Cria um novo produto para um cliente */
  createClientProduct(product: InsertClientProduct): Promise<ClientProduct>;
  /** Atualiza campos de um produto */
  updateClientProduct(id: number, updates: Partial<InsertClientProduct>): Promise<ClientProduct>;
  /** Remove um produto */
  deleteClientProduct(id: number): Promise<void>;

  /** Lista serviços de um cliente */
  getClientServices(clientId: number): Promise<ClientService[]>;
  /** Cria um novo serviço para um cliente */
  createClientService(service: InsertClientService): Promise<ClientService>;
  /** Atualiza campos de um serviço */
  updateClientService(id: number, updates: Partial<InsertClientService>): Promise<ClientService>;
  /** Remove um serviço */
  deleteClientService(id: number): Promise<void>;

  /** Lista credenciais de um cliente */
  getClientCredentials(clientId: number): Promise<ClientCredential[]>;
  /** Cria uma nova credencial para um cliente */
  createClientCredential(cred: InsertClientCredential): Promise<ClientCredential>;
  /** Atualiza campos de uma credencial */
  updateClientCredential(id: number, updates: Partial<InsertClientCredential>): Promise<ClientCredential>;
  /** Remove uma credencial */
  deleteClientCredential(id: number): Promise<void>;

  /** Lista insights de um cliente */
  getClientInsights(clientId: number): Promise<ClientInsight[]>;
  /** Lista todos os insights de todos os clientes */
  getAllClientInsights(): Promise<ClientInsight[]>;
  /** Cria um novo insight para um cliente */
  createClientInsight(insight: InsertClientInsight): Promise<ClientInsight>;
  /** Remove um insight */
  deleteClientInsight(id: number): Promise<void>;

  /** Lista acessos de onboarding de um cliente */
  getOnboardingAccess(clientId: number): Promise<ClientOnboardingAccess[]>;
  /** Define os usuários com acesso ao onboarding de um cliente (substitui lista anterior) */
  setOnboardingAccess(clientId: number, userIds: number[]): Promise<void>;

  /** Lista templates de texto de um cliente, ordenados por posição */
  getClientTextTemplates(clientId: number): Promise<ClientTextTemplate[]>;
  /** Cria um novo template de texto */
  createClientTextTemplate(template: InsertClientTextTemplate): Promise<ClientTextTemplate>;
  /** Atualiza campos de um template de texto */
  updateClientTextTemplate(id: number, updates: Partial<InsertClientTextTemplate>): Promise<ClientTextTemplate>;
  /** Remove um template de texto */
  deleteClientTextTemplate(id: number): Promise<void>;

  /** Lista arquivos de identidade visual de um cliente */
  getBrandIdentityFiles(clientId: number): Promise<BrandIdentityFile[]>;
  /** Busca um arquivo de identidade visual pelo ID */
  getBrandIdentityFile(id: number): Promise<BrandIdentityFile | undefined>;
  /** Cria um novo arquivo de identidade visual */
  createBrandIdentityFile(file: InsertBrandIdentityFile): Promise<BrandIdentityFile>;
  /** Remove um arquivo de identidade visual */
  deleteBrandIdentityFile(id: number): Promise<void>;

  /** Lista relatórios de erro com filtros opcionais de status e datas */
  getErrorReports(filters?: { status?: string; startDate?: Date; endDate?: Date }): Promise<ErrorReport[]>;
  /** Cria um novo relatório de erro */
  createErrorReport(report: InsertErrorReport): Promise<ErrorReport>;
  /** Atualiza campos de um relatório de erro */
  updateErrorReport(id: number, updates: Partial<InsertErrorReport>): Promise<ErrorReport>;

  /** Gera dados agregados de relatório de workflow do kanban com múltiplos filtros */
  getWorkflowReportData(filters: {
    clientId?: number;
    cardType?: string;
    assignedUserId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any>;

  /** Lista todos os templates de briefing */
  getBriefingTemplates(): Promise<BriefingTemplate[]>;
  /** Busca um template de briefing pelo ID */
  getBriefingTemplate(id: number): Promise<BriefingTemplate | undefined>;
  /** Cria um novo template de briefing */
  createBriefingTemplate(template: InsertBriefingTemplate): Promise<BriefingTemplate>;
  /** Atualiza campos de um template de briefing */
  updateBriefingTemplate(id: number, updates: Partial<InsertBriefingTemplate>): Promise<BriefingTemplate>;
  /** Remove um template de briefing */
  deleteBriefingTemplate(id: number): Promise<void>;

  /** Busca o valor de uma configuração do sistema pela chave */
  getSystemSetting(key: string): Promise<string | undefined>;
  /** Define ou atualiza uma configuração do sistema (upsert) */
  setSystemSetting(key: string, value: string): Promise<SystemSetting>;
  /** Busca múltiplas configurações do sistema por lista de chaves */
  getSystemSettings(keys: string[]): Promise<Record<string, string>>;
}

/**
 * Implementação concreta da interface IStorage usando PostgreSQL via Drizzle ORM.
 * Todas as operações CRUD são executadas diretamente no banco de dados.
 */
export class DatabaseStorage implements IStorage {
  /** @inheritdoc */
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  /** @inheritdoc */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  /** @inheritdoc */
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  /** @inheritdoc */
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  /** @inheritdoc */
  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  /** @inheritdoc */
  async deleteUser(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.recipientUserId, id));
    await db.delete(kanbanComments).where(eq(kanbanComments.userId, id));
    await db.delete(kanbanTimeEntries).where(eq(kanbanTimeEntries.userId, id));
    await db.delete(kanbanActivity).where(eq(kanbanActivity.userId, id));
    await db.delete(userClientAccess).where(eq(userClientAccess.userId, id));
    await db.delete(clientInsights).where(eq(clientInsights.userId, id));
    await db.delete(clientOnboardingAccess).where(eq(clientOnboardingAccess.userId, id));
    await db.update(kanbanCards).set({ createdBy: null }).where(eq(kanbanCards.createdBy, id));
    await db.execute(sql`UPDATE posts SET designer_id = NULL WHERE designer_id = ${id}`);
    await db.update(brandIdentityFiles).set({ uploadedBy: null }).where(eq(brandIdentityFiles.uploadedBy, id));
    await db.update(errorReports).set({ reporterUserId: null }).where(eq(errorReports.reporterUserId, id));
    await db.update(errorReports).set({ resolvedBy: null }).where(eq(errorReports.resolvedBy, id));
    await db.update(briefingTemplates).set({ createdBy: null }).where(eq(briefingTemplates.createdBy, id));
    await db.update(briefings).set({ createdBy: null }).where(eq(briefings.createdBy, id));
    await db.delete(users).where(eq(users.id, id));
  }

  /** @inheritdoc */
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  /** @inheritdoc */
  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  /** @inheritdoc */
  async getClientBySlug(slug: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.slug, slug));
    return client;
  }

  /** @inheritdoc */
  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  /** @inheritdoc */
  async updateClient(id: number, updates: UpdateClientRequest): Promise<Client> {
    const [updated] = await db.update(clients)
      .set(updates)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  /** @inheritdoc */
  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  /** @inheritdoc */
  async getClientCustomLinks(clientId: number): Promise<ClientCustomLink[]> {
    return await db.select().from(clientCustomLinks)
      .where(eq(clientCustomLinks.clientId, clientId))
      .orderBy(asc(clientCustomLinks.position));
  }

  /** @inheritdoc */
  async getClientCustomLink(id: number): Promise<ClientCustomLink | undefined> {
    const [link] = await db.select().from(clientCustomLinks).where(eq(clientCustomLinks.id, id));
    return link;
  }

  /** @inheritdoc */
  async createClientCustomLink(link: InsertClientCustomLink): Promise<ClientCustomLink> {
    const [created] = await db.insert(clientCustomLinks).values(link).returning();
    return created;
  }

  /** @inheritdoc */
  async updateClientCustomLink(id: number, updates: Partial<InsertClientCustomLink>): Promise<ClientCustomLink> {
    const [updated] = await db.update(clientCustomLinks)
      .set(updates)
      .where(eq(clientCustomLinks.id, id))
      .returning();
    return updated;
  }

  /** @inheritdoc */
  async deleteClientCustomLink(id: number): Promise<void> {
    await db.delete(clientCustomLinks).where(eq(clientCustomLinks.id, id));
  }

  /** @inheritdoc */
  async getPosts(): Promise<Post[]> {
    return await db.select().from(posts).orderBy(desc(posts.scheduledDate));
  }

  /** @inheritdoc */
  async getPost(id: number): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  /** @inheritdoc */
  async getPostsByClient(clientId: number): Promise<Post[]> {
    return await db.select().from(posts).where(eq(posts.clientId, clientId)).orderBy(desc(posts.scheduledDate));
  }

  /** @inheritdoc */
  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  /** @inheritdoc */
  async updatePost(id: number, updates: UpdatePostRequest): Promise<Post> {
    const [updated] = await db.update(posts)
      .set(updates)
      .where(eq(posts.id, id))
      .returning();
    return updated;
  }

  /** @inheritdoc */
  async deletePost(id: number): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  /** @inheritdoc */
  async getApprovalPosts(): Promise<ApprovalPost[]> {
    return await db.select().from(approvalPosts).orderBy(desc(approvalPosts.createdAt));
  }

  /** @inheritdoc */
  async getApprovalPost(id: number): Promise<ApprovalPost | undefined> {
    const [post] = await db.select().from(approvalPosts).where(eq(approvalPosts.id, id));
    return post;
  }

  /** @inheritdoc */
  async getApprovalPostsByClient(clientId: number): Promise<ApprovalPost[]> {
    return await db.select().from(approvalPosts).where(eq(approvalPosts.clientId, clientId)).orderBy(desc(approvalPosts.createdAt));
  }

  /** @inheritdoc */
  async getApprovalPostsByDesigner(designerId: number): Promise<ApprovalPost[]> {
    return await db.select().from(approvalPosts).where(eq(approvalPosts.designerId, designerId)).orderBy(desc(approvalPosts.createdAt));
  }

  /** @inheritdoc */
  async createApprovalPost(insertPost: InsertApprovalPost): Promise<ApprovalPost> {
    const [post] = await db.insert(approvalPosts).values(insertPost).returning();
    return post;
  }

  /** @inheritdoc */
  async updateApprovalPost(id: number, updates: UpdateApprovalPostRequest): Promise<ApprovalPost> {
    const [updated] = await db.update(approvalPosts)
      .set(updates)
      .where(eq(approvalPosts.id, id))
      .returning();
    return updated;
  }

  /** @inheritdoc */
  async deleteApprovalPost(id: number): Promise<void> {
    await db.delete(approvalPosts).where(eq(approvalPosts.id, id));
  }

  /** @inheritdoc */
  async getNotifications(recipientUserId?: number): Promise<Notification[]> {
    if (recipientUserId) {
      return await db.select().from(notifications)
        .where(eq(notifications.recipientUserId, recipientUserId))
        .orderBy(desc(notifications.createdAt));
    }
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  /** @inheritdoc */
  async getNotificationsByClient(clientId: number): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.clientId, clientId))
      .orderBy(desc(notifications.createdAt));
  }

  /** @inheritdoc */
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(notifications).values(notification).returning();
    return n;
  }

  /** @inheritdoc */
  async markNotificationRead(id: number): Promise<Notification> {
    const [n] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return n;
  }

  /** @inheritdoc */
  async markAllNotificationsRead(role: string, clientId?: number): Promise<void> {
    const conditions = [eq(notifications.isRead, false)];
    if (role === "client" && clientId) {
      conditions.push(eq(notifications.recipientRole, "client"));
      conditions.push(eq(notifications.clientId, clientId));
    } else if (role === "client") {
      conditions.push(eq(notifications.recipientRole, "client"));
    } else {
      conditions.push(
        or(
          eq(notifications.recipientRole, "admin"),
          eq(notifications.recipientRole, "designer"),
          eq(notifications.recipientRole, "all"),
        )!
      );
    }
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));
  }

  /** @inheritdoc */
  async markKanbanNotificationsRead(role: string, clientId?: number): Promise<void> {
    const kanbanTypes = ["approval_sent", "card_approved", "card_rejected", "revision_requested", "comment_added", "card_scheduled", "card_created", "card_moved"];
    const conditions = [
      eq(notifications.isRead, false),
    ];
    if (role === "client" && clientId) {
      conditions.push(eq(notifications.recipientRole, "client"));
      conditions.push(eq(notifications.clientId, clientId));
    } else if (role === "client") {
      conditions.push(eq(notifications.recipientRole, "client"));
    } else {
      conditions.push(
        or(
          eq(notifications.recipientRole, "admin"),
          eq(notifications.recipientRole, "designer"),
          eq(notifications.recipientRole, "all"),
        )!
      );
    }
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(...conditions, inArray(notifications.type, kanbanTypes)));
  }

  /** @inheritdoc */
  async markInsightNotificationsRead(role: string, clientId?: number): Promise<void> {
    const conditions = [
      eq(notifications.type, "insight"),
      eq(notifications.isRead, false),
    ];
    if (role === "client" && clientId) {
      conditions.push(eq(notifications.recipientRole, "client"));
      conditions.push(eq(notifications.clientId, clientId));
    } else if (role === "client") {
      conditions.push(eq(notifications.recipientRole, "client"));
    } else {
      conditions.push(
        or(
          eq(notifications.recipientRole, "admin"),
          eq(notifications.recipientRole, "designer"),
          eq(notifications.recipientRole, "all"),
        )!
      );
    }
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));
  }

  /** @inheritdoc */
  async markCardNotificationsRead(kanbanCardId: number, role: string, clientId?: number): Promise<void> {
    const conditions = [
      eq(notifications.isRead, false),
      eq(notifications.kanbanCardId, kanbanCardId),
    ];
    if (role === "client" && clientId) {
      conditions.push(eq(notifications.recipientRole, "client"));
      conditions.push(eq(notifications.clientId, clientId));
    } else if (role === "client") {
      conditions.push(eq(notifications.recipientRole, "client"));
    } else {
      conditions.push(
        or(
          eq(notifications.recipientRole, "admin"),
          eq(notifications.recipientRole, "designer"),
          eq(notifications.recipientRole, "all"),
        )!
      );
    }
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));
  }

  /** @inheritdoc */
  async getCompetitors(): Promise<Competitor[]> {
    return await db.select().from(competitors).orderBy(desc(competitors.createdAt));
  }

  /** @inheritdoc */
  async getCompetitorsByClient(clientId: number): Promise<Competitor[]> {
    return await db.select().from(competitors).where(eq(competitors.clientId, clientId)).orderBy(desc(competitors.createdAt));
  }

  /** @inheritdoc */
  async getCompetitor(id: number): Promise<Competitor | undefined> {
    const [comp] = await db.select().from(competitors).where(eq(competitors.id, id));
    return comp;
  }

  /** @inheritdoc */
  async createCompetitor(competitor: InsertCompetitor): Promise<Competitor> {
    const [comp] = await db.insert(competitors).values(competitor).returning();
    return comp;
  }

  /** @inheritdoc */
  async updateCompetitor(id: number, updates: Partial<InsertCompetitor>): Promise<Competitor> {
    const [comp] = await db.update(competitors).set(updates).where(eq(competitors.id, id)).returning();
    return comp;
  }

  /** @inheritdoc */
  async deleteCompetitor(id: number): Promise<void> {
    await db.delete(competitors).where(eq(competitors.id, id));
  }

  /** @inheritdoc */
  async getBriefings(): Promise<Briefing[]> {
    return await db.select().from(briefings).orderBy(desc(briefings.createdAt));
  }

  /** @inheritdoc */
  async getBriefingsByClient(clientId: number): Promise<Briefing[]> {
    return await db.select().from(briefings).where(eq(briefings.clientId, clientId)).orderBy(desc(briefings.createdAt));
  }

  /** @inheritdoc */
  async getBriefing(id: number): Promise<Briefing | undefined> {
    const [b] = await db.select().from(briefings).where(eq(briefings.id, id));
    return b;
  }

  /** @inheritdoc */
  async getBriefingByToken(token: string): Promise<Briefing | undefined> {
    const [b] = await db.select().from(briefings).where(eq(briefings.token, token));
    return b;
  }

  /** @inheritdoc */
  async createBriefing(briefing: InsertBriefing): Promise<Briefing> {
    const [b] = await db.insert(briefings).values(briefing).returning();
    return b;
  }

  /** @inheritdoc */
  async updateBriefing(id: number, updates: Partial<InsertBriefing>): Promise<Briefing> {
    const [b] = await db.update(briefings).set(updates).where(eq(briefings.id, id)).returning();
    return b;
  }

  /** @inheritdoc */
  async deleteBriefing(id: number): Promise<void> {
    await db.delete(briefings).where(eq(briefings.id, id));
  }

  /** @inheritdoc */
  async getKanbanColumnsByClient(clientId: number): Promise<KanbanColumn[]> {
    return await db.select().from(kanbanColumns).where(eq(kanbanColumns.clientId, clientId)).orderBy(asc(kanbanColumns.position));
  }

  /** @inheritdoc */
  async getKanbanColumn(id: number): Promise<KanbanColumn | undefined> {
    const [col] = await db.select().from(kanbanColumns).where(eq(kanbanColumns.id, id));
    return col;
  }

  /** @inheritdoc */
  async createKanbanColumn(col: InsertKanbanColumn): Promise<KanbanColumn> {
    const [c] = await db.insert(kanbanColumns).values(col).returning();
    return c;
  }

  /** @inheritdoc */
  async updateKanbanColumn(id: number, updates: Partial<InsertKanbanColumn>): Promise<KanbanColumn> {
    const [c] = await db.update(kanbanColumns).set(updates).where(eq(kanbanColumns.id, id)).returning();
    return c;
  }

  /** @inheritdoc */
  async deleteKanbanColumn(id: number): Promise<void> {
    await db.delete(kanbanCards).where(eq(kanbanCards.columnId, id));
    await db.delete(kanbanColumns).where(eq(kanbanColumns.id, id));
  }

  /** @inheritdoc */
  async reorderKanbanColumns(clientId: number, columnIds: number[]): Promise<void> {
    for (let i = 0; i < columnIds.length; i++) {
      await db.update(kanbanColumns).set({ position: i }).where(and(eq(kanbanColumns.id, columnIds[i]), eq(kanbanColumns.clientId, clientId)));
    }
  }

  /** @inheritdoc */
  async getKanbanCardsByColumn(columnId: number): Promise<KanbanCard[]> {
    return await db.select().from(kanbanCards).where(eq(kanbanCards.columnId, columnId)).orderBy(asc(kanbanCards.position));
  }

  /** @inheritdoc */
  async getKanbanCardsByClient(clientId: number): Promise<KanbanCard[]> {
    return await db.select().from(kanbanCards).where(eq(kanbanCards.clientId, clientId)).orderBy(asc(kanbanCards.position));
  }

  /** @inheritdoc */
  async getKanbanCard(id: number): Promise<KanbanCard | undefined> {
    const [c] = await db.select().from(kanbanCards).where(eq(kanbanCards.id, id));
    return c;
  }

  /** @inheritdoc */
  async createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard> {
    const [c] = await db.insert(kanbanCards).values(card).returning();
    return c;
  }

  /** @inheritdoc */
  async updateKanbanCard(id: number, updates: Partial<InsertKanbanCard>): Promise<KanbanCard> {
    const [c] = await db.update(kanbanCards).set({ ...updates, updatedAt: new Date() }).where(eq(kanbanCards.id, id)).returning();
    return c;
  }

  /** @inheritdoc */
  async deleteKanbanCard(id: number): Promise<void> {
    await db.delete(kanbanComments).where(eq(kanbanComments.cardId, id));
    await db.delete(kanbanActivity).where(eq(kanbanActivity.cardId, id));
    await db.delete(kanbanTimeEntries).where(eq(kanbanTimeEntries.cardId, id));
    await db.delete(kanbanCards).where(eq(kanbanCards.id, id));
  }

  /**
   * Busca um card do kanban associado a um post de aprovação específico.
   * @param approvalPostId - ID do post de aprovação
   * @returns Card encontrado ou undefined
   */
  async getKanbanCardByApprovalPostId(approvalPostId: number): Promise<KanbanCard | undefined> {
    const [c] = await db.select().from(kanbanCards).where(eq(kanbanCards.approvalPostId, approvalPostId));
    return c;
  }

  /** @inheritdoc */
  async moveKanbanCard(cardId: number, toColumnId: number, newPosition: number): Promise<KanbanCard> {
    const [existing] = await db.select().from(kanbanCards).where(eq(kanbanCards.id, cardId));
    const columnChanged = existing && existing.columnId !== toColumnId;
    const [c] = await db.update(kanbanCards).set({
      columnId: toColumnId,
      position: newPosition,
      updatedAt: new Date(),
      ...(columnChanged ? { columnEnteredAt: new Date() } : {}),
    }).where(eq(kanbanCards.id, cardId)).returning();
    return c;
  }

  /** @inheritdoc */
  async getKanbanComments(cardId: number): Promise<KanbanComment[]> {
    return await db.select().from(kanbanComments).where(eq(kanbanComments.cardId, cardId)).orderBy(desc(kanbanComments.createdAt));
  }

  /** @inheritdoc */
  async createKanbanComment(comment: InsertKanbanComment): Promise<KanbanComment> {
    const [c] = await db.insert(kanbanComments).values(comment).returning();
    return c;
  }

  /** @inheritdoc */
  async deleteKanbanComment(id: number): Promise<void> {
    await db.delete(kanbanComments).where(eq(kanbanComments.id, id));
  }

  /** @inheritdoc */
  async getApprovedKanbanCards(): Promise<KanbanCard[]> {
    return await db.select().from(kanbanCards).where(eq(kanbanCards.approvalStatus, "Aprovado"));
  }

  /** @inheritdoc */
  async getScheduledKanbanCards(): Promise<{ card: KanbanCard; columnTitle: string }[]> {
    const allColumns = await db.select().from(kanbanColumns);
    const scheduledColumnIds = allColumns
      .filter(c => c.title === "Agendados" || c.title === "Postados")
      .map(c => c.id);
    if (scheduledColumnIds.length === 0) return [];
    const cards = await db.select().from(kanbanCards)
      .where(inArray(kanbanCards.columnId, scheduledColumnIds));
    const columnMap = new Map(allColumns.map(c => [c.id, c.title]));
    return cards.map(card => ({
      card,
      columnTitle: columnMap.get(card.columnId) || "",
    }));
  }

  /** @inheritdoc */
  async getKanbanActivity(cardId: number): Promise<KanbanActivity[]> {
    return await db.select().from(kanbanActivity).where(eq(kanbanActivity.cardId, cardId)).orderBy(desc(kanbanActivity.createdAt));
  }

  /** @inheritdoc */
  async createKanbanActivity(activity: { cardId: number; userId: number | null; action: string; fromColumnId?: number; toColumnId?: number; details?: string }): Promise<KanbanActivity> {
    const [a] = await db.insert(kanbanActivity).values(activity).returning();
    return a;
  }

  /** @inheritdoc */
  async getKanbanTimeEntries(cardId: number): Promise<KanbanTimeEntry[]> {
    return await db.select().from(kanbanTimeEntries).where(eq(kanbanTimeEntries.cardId, cardId)).orderBy(desc(kanbanTimeEntries.startedAt));
  }

  /** @inheritdoc */
  async getKanbanTimeEntriesByCardIds(cardIds: number[]): Promise<KanbanTimeEntry[]> {
    if (cardIds.length === 0) return [];
    return await db.select().from(kanbanTimeEntries).where(inArray(kanbanTimeEntries.cardId, cardIds)).orderBy(desc(kanbanTimeEntries.startedAt));
  }

  /** @inheritdoc */
  async getOpenTimeEntry(cardId: number): Promise<KanbanTimeEntry | undefined> {
    const [entry] = await db.select().from(kanbanTimeEntries).where(and(eq(kanbanTimeEntries.cardId, cardId), isNull(kanbanTimeEntries.endedAt)));
    return entry;
  }

  /** @inheritdoc */
  async startTimeEntry(cardId: number, userId: number, columnId?: number): Promise<KanbanTimeEntry> {
    const [entry] = await db.insert(kanbanTimeEntries).values({ cardId, userId, columnId: columnId ?? null, startedAt: new Date() }).returning();
    return entry;
  }

  /** @inheritdoc */
  async stopTimeEntry(entryId: number): Promise<KanbanTimeEntry> {
    const entry = await db.select().from(kanbanTimeEntries).where(eq(kanbanTimeEntries.id, entryId));
    if (!entry[0]) throw new Error("Time entry not found");
    const now = new Date();
    const totalSeconds = Math.floor((now.getTime() - new Date(entry[0].startedAt).getTime()) / 1000);
    const [updated] = await db.update(kanbanTimeEntries).set({ endedAt: now, totalSeconds }).where(eq(kanbanTimeEntries.id, entryId)).returning();
    return updated;
  }

  /** @inheritdoc */
  async getTimeEntriesByUser(userId: number, startDate?: Date, endDate?: Date): Promise<KanbanTimeEntry[]> {
    const conditions = [eq(kanbanTimeEntries.userId, userId)];
    return await db.select().from(kanbanTimeEntries).where(and(...conditions)).orderBy(desc(kanbanTimeEntries.startedAt));
  }

  /** @inheritdoc */
  async getUserClientAccess(userId: number): Promise<UserClientAccess[]> {
    return await db.select().from(userClientAccess).where(eq(userClientAccess.userId, userId));
  }

  /** @inheritdoc */
  async getClientAccessUsers(clientId: number): Promise<UserClientAccess[]> {
    return await db.select().from(userClientAccess).where(eq(userClientAccess.clientId, clientId));
  }

  /** @inheritdoc */
  async grantClientAccess(userId: number, clientId: number): Promise<UserClientAccess> {
    const existing = await db.select().from(userClientAccess).where(and(eq(userClientAccess.userId, userId), eq(userClientAccess.clientId, clientId)));
    if (existing.length > 0) return existing[0];
    const [entry] = await db.insert(userClientAccess).values({ userId, clientId }).returning();
    return entry;
  }

  /** @inheritdoc */
  async revokeClientAccess(userId: number, clientId: number): Promise<void> {
    await db.delete(userClientAccess).where(and(eq(userClientAccess.userId, userId), eq(userClientAccess.clientId, clientId)));
  }

  /** @inheritdoc */
  async revokeAllClientAccess(userId: number): Promise<void> {
    await db.delete(userClientAccess).where(eq(userClientAccess.userId, userId));
  }

  /** @inheritdoc */
  async getClientProducts(clientId: number): Promise<ClientProduct[]> {
    return await db.select().from(clientProducts).where(eq(clientProducts.clientId, clientId)).orderBy(desc(clientProducts.id));
  }
  /** @inheritdoc */
  async createClientProduct(product: InsertClientProduct): Promise<ClientProduct> {
    const [p] = await db.insert(clientProducts).values(product).returning();
    return p;
  }
  /** @inheritdoc */
  async updateClientProduct(id: number, updates: Partial<InsertClientProduct>): Promise<ClientProduct> {
    const [p] = await db.update(clientProducts).set(updates).where(eq(clientProducts.id, id)).returning();
    return p;
  }
  /** @inheritdoc */
  async deleteClientProduct(id: number): Promise<void> {
    await db.delete(clientProducts).where(eq(clientProducts.id, id));
  }

  /** @inheritdoc */
  async getClientServices(clientId: number): Promise<ClientService[]> {
    return await db.select().from(clientServices).where(eq(clientServices.clientId, clientId)).orderBy(desc(clientServices.id));
  }
  /** @inheritdoc */
  async createClientService(service: InsertClientService): Promise<ClientService> {
    const [s] = await db.insert(clientServices).values(service).returning();
    return s;
  }
  /** @inheritdoc */
  async updateClientService(id: number, updates: Partial<InsertClientService>): Promise<ClientService> {
    const [s] = await db.update(clientServices).set(updates).where(eq(clientServices.id, id)).returning();
    return s;
  }
  /** @inheritdoc */
  async deleteClientService(id: number): Promise<void> {
    await db.delete(clientServices).where(eq(clientServices.id, id));
  }

  /** @inheritdoc */
  async getClientCredentials(clientId: number): Promise<ClientCredential[]> {
    return await db.select().from(clientCredentials).where(eq(clientCredentials.clientId, clientId)).orderBy(desc(clientCredentials.id));
  }
  /** @inheritdoc */
  async createClientCredential(cred: InsertClientCredential): Promise<ClientCredential> {
    const [c] = await db.insert(clientCredentials).values(cred).returning();
    return c;
  }
  /** @inheritdoc */
  async updateClientCredential(id: number, updates: Partial<InsertClientCredential>): Promise<ClientCredential> {
    const [c] = await db.update(clientCredentials).set(updates).where(eq(clientCredentials.id, id)).returning();
    return c;
  }
  /** @inheritdoc */
  async deleteClientCredential(id: number): Promise<void> {
    await db.delete(clientCredentials).where(eq(clientCredentials.id, id));
  }

  /** @inheritdoc */
  async getClientInsights(clientId: number): Promise<ClientInsight[]> {
    return await db.select().from(clientInsights).where(eq(clientInsights.clientId, clientId)).orderBy(desc(clientInsights.createdAt));
  }
  /** @inheritdoc */
  async getAllClientInsights(): Promise<ClientInsight[]> {
    return await db.select().from(clientInsights).orderBy(desc(clientInsights.createdAt));
  }
  /** @inheritdoc */
  async createClientInsight(insight: InsertClientInsight): Promise<ClientInsight> {
    const [i] = await db.insert(clientInsights).values(insight).returning();
    return i;
  }
  /** @inheritdoc */
  async deleteClientInsight(id: number): Promise<void> {
    await db.delete(clientInsights).where(eq(clientInsights.id, id));
  }

  /** @inheritdoc */
  async getOnboardingAccess(clientId: number): Promise<ClientOnboardingAccess[]> {
    return await db.select().from(clientOnboardingAccess).where(eq(clientOnboardingAccess.clientId, clientId));
  }
  /** @inheritdoc */
  async setOnboardingAccess(clientId: number, userIds: number[]): Promise<void> {
    await db.delete(clientOnboardingAccess).where(eq(clientOnboardingAccess.clientId, clientId));
    if (userIds.length > 0) {
      await db.insert(clientOnboardingAccess).values(userIds.map(userId => ({ clientId, userId })));
    }
  }

  /** @inheritdoc */
  async getClientTextTemplates(clientId: number): Promise<ClientTextTemplate[]> {
    return await db.select().from(clientTextTemplates).where(eq(clientTextTemplates.clientId, clientId)).orderBy(asc(clientTextTemplates.position));
  }

  /** @inheritdoc */
  async createClientTextTemplate(template: InsertClientTextTemplate): Promise<ClientTextTemplate> {
    const [t] = await db.insert(clientTextTemplates).values(template).returning();
    return t;
  }

  /** @inheritdoc */
  async updateClientTextTemplate(id: number, updates: Partial<InsertClientTextTemplate>): Promise<ClientTextTemplate> {
    const [t] = await db.update(clientTextTemplates).set(updates).where(eq(clientTextTemplates.id, id)).returning();
    return t;
  }

  /** @inheritdoc */
  async deleteClientTextTemplate(id: number): Promise<void> {
    await db.delete(clientTextTemplates).where(eq(clientTextTemplates.id, id));
  }

  /** @inheritdoc */
  async getBrandIdentityFiles(clientId: number): Promise<BrandIdentityFile[]> {
    return await db.select().from(brandIdentityFiles).where(eq(brandIdentityFiles.clientId, clientId)).orderBy(desc(brandIdentityFiles.createdAt));
  }

  /** @inheritdoc */
  async getBrandIdentityFile(id: number): Promise<BrandIdentityFile | undefined> {
    const [f] = await db.select().from(brandIdentityFiles).where(eq(brandIdentityFiles.id, id));
    return f;
  }

  /** @inheritdoc */
  async createBrandIdentityFile(file: InsertBrandIdentityFile): Promise<BrandIdentityFile> {
    const [f] = await db.insert(brandIdentityFiles).values(file).returning();
    return f;
  }

  /** @inheritdoc */
  async deleteBrandIdentityFile(id: number): Promise<void> {
    await db.delete(brandIdentityFiles).where(eq(brandIdentityFiles.id, id));
  }

  /** @inheritdoc */
  async getErrorReports(filters?: { status?: string; startDate?: Date; endDate?: Date }): Promise<ErrorReport[]> {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(errorReports.status, filters.status));
    if (filters?.startDate) conditions.push(gte(errorReports.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(errorReports.createdAt, filters.endDate));

    if (conditions.length > 0) {
      return await db.select().from(errorReports).where(and(...conditions)).orderBy(desc(errorReports.createdAt));
    }
    return await db.select().from(errorReports).orderBy(desc(errorReports.createdAt));
  }

  /** @inheritdoc */
  async createErrorReport(report: InsertErrorReport): Promise<ErrorReport> {
    const [r] = await db.insert(errorReports).values(report).returning();
    return r;
  }

  /** @inheritdoc */
  async updateErrorReport(id: number, updates: Partial<InsertErrorReport>): Promise<ErrorReport> {
    const [r] = await db.update(errorReports).set(updates).where(eq(errorReports.id, id)).returning();
    return r;
  }

  /**
   * Gera dados agregados de relatório de workflow do kanban.
   * Calcula estatísticas como total de cards, distribuição por status/tipo/cliente,
   * contagens de aprovação e tempo médio de aprovação.
   * @param filters - Filtros opcionais por cliente, tipo de card, usuário e período
   * @returns Objeto com métricas agregadas e lista de cards filtrados
   */
  async getWorkflowReportData(filters: {
    clientId?: number;
    cardType?: string;
    assignedUserId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    const conditions: any[] = [];
    if (filters.clientId) conditions.push(eq(kanbanCards.clientId, filters.clientId));
    if (filters.cardType) conditions.push(eq(kanbanCards.cardType, filters.cardType));
    if (filters.startDate) conditions.push(gte(kanbanCards.createdAt, filters.startDate));
    if (filters.endDate) conditions.push(lte(kanbanCards.createdAt, filters.endDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let cards = whereClause
      ? await db.select().from(kanbanCards).where(whereClause).orderBy(desc(kanbanCards.createdAt))
      : await db.select().from(kanbanCards).orderBy(desc(kanbanCards.createdAt));

    if (filters.assignedUserId) {
      const movedCardIds = await db
        .selectDistinct({ cardId: kanbanActivity.cardId })
        .from(kanbanActivity)
        .where(and(
          eq(kanbanActivity.userId, filters.assignedUserId),
          eq(kanbanActivity.action, "moved")
        ));
      const movedSet = new Set(movedCardIds.map(r => r.cardId));

      cards = cards.filter(card =>
        (card.assignedUserIds && (card.assignedUserIds as number[]).includes(filters.assignedUserId!)) ||
        card.createdBy === filters.assignedUserId ||
        movedSet.has(card.id)
      );
    }

    const totalCards = cards.length;
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byClient: Record<number, number> = {};
    let approvedCount = 0;
    let rejectedCount = 0;
    let revisionCount = 0;
    let pendingCount = 0;
    let totalApprovalTimeMs = 0;
    let approvalTimeCount = 0;

    const allColumns = await db.select().from(kanbanColumns);
    const columnMap = new Map(allColumns.map(c => [c.id, c.title]));
    let scheduledCount = 0;
    let waitingScheduleCount = 0;
    let postedCount = 0;
    let finishedCount = 0;

    for (const card of cards) {
      const status = card.approvalStatus || "sem_aprovacao";
      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[card.cardType || "geral"] = (byType[card.cardType || "geral"] || 0) + 1;
      byClient[card.clientId] = (byClient[card.clientId] || 0) + 1;

      if (card.approvalStatus === "Aprovado") approvedCount++;
      else if (card.approvalStatus === "Reprovado") rejectedCount++;
      else if (card.approvalStatus === "Revisão") revisionCount++;
      else if (card.approvalStatus === "Pendente") pendingCount++;

      if (card.approvalSentAt && card.approvalResolvedAt) {
        totalApprovalTimeMs += new Date(card.approvalResolvedAt).getTime() - new Date(card.approvalSentAt).getTime();
        approvalTimeCount++;
      }

      const colTitle = columnMap.get(card.columnId);
      if (colTitle === "Agendados") scheduledCount++;
      else if (colTitle === "Agendamento") waitingScheduleCount++;
      else if (colTitle === "Postados") postedCount++;
      else if (colTitle === "Finalizados") finishedCount++;
    }

    const avgApprovalTimeHours = approvalTimeCount > 0 ? totalApprovalTimeMs / approvalTimeCount / (1000 * 60 * 60) : 0;

    return {
      totalCards,
      byStatus,
      byType,
      byClient,
      approvedCount,
      rejectedCount,
      revisionCount,
      pendingCount,
      scheduledCount,
      waitingScheduleCount,
      postedCount,
      finishedCount,
      avgApprovalTimeHours: Math.round(avgApprovalTimeHours * 10) / 10,
      cards,
    };
  }

  /**
   * Gera dados detalhados de relatório de movimentação do kanban.
   * Analisa todas as atividades de movimentação de cards, agregando por usuário,
   * calculando tempo em cada coluna e gerando relatórios de produtividade.
   * @param filters - Filtros opcionais por cliente, usuário e período
   * @returns Objeto com relatórios por usuário, tempo por coluna e totais agregados
   */
  async getMovementReportData(filters?: { clientId?: number; userId?: number; startDate?: Date; endDate?: Date }): Promise<any> {
    const conditions: any[] = [eq(kanbanActivity.action, "moved")];
    if (filters?.userId) conditions.push(eq(kanbanActivity.userId, filters.userId));
    if (filters?.startDate) conditions.push(gte(kanbanActivity.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(kanbanActivity.createdAt, filters.endDate));

    let movements = await db.select().from(kanbanActivity).where(and(...conditions)).orderBy(asc(kanbanActivity.cardId), asc(kanbanActivity.createdAt));

    if (filters?.clientId) {
      const clientCards = await db.select({ id: kanbanCards.id }).from(kanbanCards).where(eq(kanbanCards.clientId, filters.clientId));
      const clientCardIds = new Set(clientCards.map(c => c.id));
      movements = movements.filter(m => clientCardIds.has(m.cardId));
    }

    const allColumns = await db.select().from(kanbanColumns);
    const columnMap = new Map(allColumns.map(c => [c.id, c.title]));

    const allCards = await db.select().from(kanbanCards);
    const cardMap = new Map(allCards.map(c => [c.id, c]));

    const allClients = await db.select().from(clients);
    const clientMap = new Map(allClients.map(c => [c.id, c.name]));

    const allUsers = await db.select().from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u.name]));

    const byUser: Record<number, {
      userId: number;
      userName: string;
      totalMoves: number;
      cardsTouched: Set<number>;
      columnMovements: Record<string, number>;
      cardDetails: Record<number, { cardTitle: string; clientName: string; moves: { from: string; to: string; movedAt: Date }[] }>;
    }> = {};

    const timePerCardColumn: Record<number, { cardId: number; entries: { columnName: string; enteredAt: Date; exitedAt: Date | null; durationMs: number; movedByUserId: number | null }[] }> = {};

    const movementsByCard: Record<number, typeof movements> = {};
    for (const m of movements) {
      if (!movementsByCard[m.cardId]) movementsByCard[m.cardId] = [];
      movementsByCard[m.cardId].push(m);
    }

    for (const cardIdStr of Object.keys(movementsByCard)) {
      const cardId = Number(cardIdStr);
      const cardMovements = movementsByCard[cardId];
      const card = cardMap.get(cardId);
      if (!card) continue;

      if (!timePerCardColumn[cardId]) {
        timePerCardColumn[cardId] = { cardId, entries: [] };
      }

      for (let i = 0; i < cardMovements.length; i++) {
        const mov = cardMovements[i];
        const nextMov = cardMovements[i + 1];
        const userId = mov.userId;

        if (userId) {
          if (!byUser[userId]) {
            byUser[userId] = {
              userId,
              userName: userMap.get(userId) || `Usuário ${userId}`,
              totalMoves: 0,
              cardsTouched: new Set(),
              columnMovements: {},
              cardDetails: {},
            };
          }

          const userData = byUser[userId];
          userData.totalMoves++;
          userData.cardsTouched.add(cardId);

          const toColName = mov.toColumnId ? (columnMap.get(mov.toColumnId) || "Desconhecida") : "Desconhecida";
          userData.columnMovements[toColName] = (userData.columnMovements[toColName] || 0) + 1;

          const clientName = clientMap.get(card.clientId) || `Cliente ${card.clientId}`;
          if (!userData.cardDetails[cardId]) {
            userData.cardDetails[cardId] = { cardTitle: card.title, clientName, moves: [] };
          }
          const fromColName = mov.fromColumnId ? (columnMap.get(mov.fromColumnId) || "Desconhecida") : "Desconhecida";
          userData.cardDetails[cardId].moves.push({
            from: fromColName,
            to: toColName,
            movedAt: mov.createdAt!,
          });
        }

        if (mov.toColumnId) {
          const enteredAt = mov.createdAt!;
          const exitedAt = nextMov?.createdAt || null;
          const durationMs = exitedAt ? (new Date(exitedAt).getTime() - new Date(enteredAt).getTime()) : (Date.now() - new Date(enteredAt).getTime());
          const columnName = columnMap.get(mov.toColumnId) || "Desconhecida";

          timePerCardColumn[cardId].entries.push({
            columnName,
            enteredAt,
            exitedAt,
            durationMs,
            movedByUserId: userId,
          });
        }
      }
    }

    const userReports = Object.values(byUser).map(u => ({
      userId: u.userId,
      userName: u.userName,
      totalMoves: u.totalMoves,
      totalCardsTouched: u.cardsTouched.size,
      columnMovements: u.columnMovements,
      cards: Object.entries(u.cardDetails).map(([id, detail]) => ({
        cardId: Number(id),
        cardTitle: detail.cardTitle,
        clientName: detail.clientName,
        totalMoves: detail.moves.length,
        moves: detail.moves.map(m => ({
          from: m.from,
          to: m.to,
          movedAt: m.movedAt,
        })),
      })),
    })).sort((a, b) => b.totalMoves - a.totalMoves);

    const columnTimeAggregated: Record<string, { totalMs: number; count: number }> = {};
    for (const cardData of Object.values(timePerCardColumn)) {
      for (const entry of cardData.entries) {
        if (!columnTimeAggregated[entry.columnName]) {
          columnTimeAggregated[entry.columnName] = { totalMs: 0, count: 0 };
        }
        columnTimeAggregated[entry.columnName].totalMs += entry.durationMs;
        columnTimeAggregated[entry.columnName].count++;
      }
    }

    const columnTimeReport = Object.entries(columnTimeAggregated).map(([name, data]) => ({
      columnName: name,
      totalHours: Math.round((data.totalMs / 3600000) * 10) / 10,
      avgHours: Math.round((data.totalMs / data.count / 3600000) * 10) / 10,
      totalEntries: data.count,
    })).sort((a, b) => b.totalHours - a.totalHours);

    return {
      totalMovements: movements.length,
      totalUsersActive: Object.keys(byUser).length,
      totalCardsWithMovements: Object.keys(movementsByCard).length,
      userReports,
      columnTimeReport,
    };
  }

  /** @inheritdoc */
  async getBriefingTemplates(): Promise<BriefingTemplate[]> {
    return db.select().from(briefingTemplates).orderBy(desc(briefingTemplates.createdAt));
  }

  /** @inheritdoc */
  async getBriefingTemplate(id: number): Promise<BriefingTemplate | undefined> {
    const [template] = await db.select().from(briefingTemplates).where(eq(briefingTemplates.id, id));
    return template;
  }

  /** @inheritdoc */
  async createBriefingTemplate(template: InsertBriefingTemplate): Promise<BriefingTemplate> {
    const [created] = await db.insert(briefingTemplates).values(template).returning();
    return created;
  }

  /** @inheritdoc */
  async updateBriefingTemplate(id: number, updates: Partial<InsertBriefingTemplate>): Promise<BriefingTemplate> {
    const [updated] = await db.update(briefingTemplates).set(updates).where(eq(briefingTemplates.id, id)).returning();
    return updated;
  }

  /** @inheritdoc */
  async deleteBriefingTemplate(id: number): Promise<void> {
    await db.delete(briefingTemplates).where(eq(briefingTemplates.id, id));
  }

  /** @inheritdoc */
  async getSystemSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting?.value;
  }

  /** @inheritdoc */
  async setSystemSetting(key: string, value: string): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(key);
    if (existing !== undefined) {
      const [updated] = await db.update(systemSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings).values({ key, value }).returning();
    return created;
  }

  /** @inheritdoc */
  async getSystemSettings(keys: string[]): Promise<Record<string, string>> {
    const results = await db.select().from(systemSettings);
    const map: Record<string, string> = {};
    for (const row of results) {
      if (keys.includes(row.key)) {
        map[row.key] = row.value;
      }
    }
    return map;
  }
}

/**
 * Instância singleton do armazenamento usado por toda a aplicação.
 * Implementa IStorage com acesso direto ao PostgreSQL via Drizzle ORM.
 */
export const storage = new DatabaseStorage();
