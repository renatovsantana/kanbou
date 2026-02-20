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

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  getClientBySlug(slug: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: UpdateClientRequest): Promise<Client>;
  deleteClient(id: number): Promise<void>;

  getClientCustomLinks(clientId: number): Promise<ClientCustomLink[]>;
  getClientCustomLink(id: number): Promise<ClientCustomLink | undefined>;
  createClientCustomLink(link: InsertClientCustomLink): Promise<ClientCustomLink>;
  updateClientCustomLink(id: number, updates: Partial<InsertClientCustomLink>): Promise<ClientCustomLink>;
  deleteClientCustomLink(id: number): Promise<void>;

  getPosts(): Promise<Post[]>;
  getPost(id: number): Promise<Post | undefined>;
  getPostsByClient(clientId: number): Promise<Post[]>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: number, updates: UpdatePostRequest): Promise<Post>;
  deletePost(id: number): Promise<void>;

  getApprovalPosts(): Promise<ApprovalPost[]>;
  getApprovalPost(id: number): Promise<ApprovalPost | undefined>;
  getApprovalPostsByClient(clientId: number): Promise<ApprovalPost[]>;
  getApprovalPostsByDesigner(designerId: number): Promise<ApprovalPost[]>;
  createApprovalPost(post: InsertApprovalPost): Promise<ApprovalPost>;
  updateApprovalPost(id: number, updates: UpdateApprovalPostRequest): Promise<ApprovalPost>;
  deleteApprovalPost(id: number): Promise<void>;

  getNotifications(recipientUserId?: number): Promise<Notification[]>;
  getNotificationsByClient(clientId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<Notification>;
  markAllNotificationsRead(recipientUserId: number): Promise<void>;
  markInsightNotificationsRead(role: string, clientId?: number): Promise<void>;
  markKanbanNotificationsRead(role: string, clientId?: number): Promise<void>;

  getCompetitors(): Promise<Competitor[]>;
  getCompetitorsByClient(clientId: number): Promise<Competitor[]>;
  getCompetitor(id: number): Promise<Competitor | undefined>;
  createCompetitor(competitor: InsertCompetitor): Promise<Competitor>;
  updateCompetitor(id: number, updates: Partial<InsertCompetitor>): Promise<Competitor>;
  deleteCompetitor(id: number): Promise<void>;

  getBriefings(): Promise<Briefing[]>;
  getBriefingsByClient(clientId: number): Promise<Briefing[]>;
  getBriefing(id: number): Promise<Briefing | undefined>;
  getBriefingByToken(token: string): Promise<Briefing | undefined>;
  createBriefing(briefing: InsertBriefing): Promise<Briefing>;
  updateBriefing(id: number, updates: Partial<InsertBriefing>): Promise<Briefing>;
  deleteBriefing(id: number): Promise<void>;

  getKanbanColumnsByClient(clientId: number): Promise<KanbanColumn[]>;
  getKanbanColumn(id: number): Promise<KanbanColumn | undefined>;
  createKanbanColumn(col: InsertKanbanColumn): Promise<KanbanColumn>;
  updateKanbanColumn(id: number, updates: Partial<InsertKanbanColumn>): Promise<KanbanColumn>;
  deleteKanbanColumn(id: number): Promise<void>;
  reorderKanbanColumns(clientId: number, columnIds: number[]): Promise<void>;

  getKanbanCardsByColumn(columnId: number): Promise<KanbanCard[]>;
  getKanbanCardsByClient(clientId: number): Promise<KanbanCard[]>;
  getKanbanCard(id: number): Promise<KanbanCard | undefined>;
  createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard>;
  updateKanbanCard(id: number, updates: Partial<InsertKanbanCard>): Promise<KanbanCard>;
  deleteKanbanCard(id: number): Promise<void>;
  moveKanbanCard(cardId: number, toColumnId: number, newPosition: number): Promise<KanbanCard>;

  getKanbanComments(cardId: number): Promise<KanbanComment[]>;
  createKanbanComment(comment: InsertKanbanComment): Promise<KanbanComment>;
  deleteKanbanComment(id: number): Promise<void>;

  getApprovedKanbanCards(): Promise<KanbanCard[]>;
  getScheduledKanbanCards(): Promise<{ card: KanbanCard; columnTitle: string }[]>;
  getKanbanActivity(cardId: number): Promise<KanbanActivity[]>;
  createKanbanActivity(activity: { cardId: number; userId: number | null; action: string; fromColumnId?: number; toColumnId?: number; details?: string }): Promise<KanbanActivity>;
  getMovementReportData(filters?: { clientId?: number; userId?: number; startDate?: Date; endDate?: Date }): Promise<any>;

  getKanbanTimeEntries(cardId: number): Promise<KanbanTimeEntry[]>;
  getOpenTimeEntry(cardId: number): Promise<KanbanTimeEntry | undefined>;
  startTimeEntry(cardId: number, userId: number): Promise<KanbanTimeEntry>;
  stopTimeEntry(entryId: number): Promise<KanbanTimeEntry>;
  getTimeEntriesByUser(userId: number, startDate?: Date, endDate?: Date): Promise<KanbanTimeEntry[]>;

  getUserClientAccess(userId: number): Promise<UserClientAccess[]>;
  getClientAccessUsers(clientId: number): Promise<UserClientAccess[]>;
  grantClientAccess(userId: number, clientId: number): Promise<UserClientAccess>;
  revokeClientAccess(userId: number, clientId: number): Promise<void>;
  revokeAllClientAccess(userId: number): Promise<void>;

  getClientProducts(clientId: number): Promise<ClientProduct[]>;
  createClientProduct(product: InsertClientProduct): Promise<ClientProduct>;
  updateClientProduct(id: number, updates: Partial<InsertClientProduct>): Promise<ClientProduct>;
  deleteClientProduct(id: number): Promise<void>;

  getClientServices(clientId: number): Promise<ClientService[]>;
  createClientService(service: InsertClientService): Promise<ClientService>;
  updateClientService(id: number, updates: Partial<InsertClientService>): Promise<ClientService>;
  deleteClientService(id: number): Promise<void>;

  getClientCredentials(clientId: number): Promise<ClientCredential[]>;
  createClientCredential(cred: InsertClientCredential): Promise<ClientCredential>;
  updateClientCredential(id: number, updates: Partial<InsertClientCredential>): Promise<ClientCredential>;
  deleteClientCredential(id: number): Promise<void>;

  getClientInsights(clientId: number): Promise<ClientInsight[]>;
  getAllClientInsights(): Promise<ClientInsight[]>;
  createClientInsight(insight: InsertClientInsight): Promise<ClientInsight>;
  deleteClientInsight(id: number): Promise<void>;

  getOnboardingAccess(clientId: number): Promise<ClientOnboardingAccess[]>;
  setOnboardingAccess(clientId: number, userIds: number[]): Promise<void>;

  getBrandIdentityFiles(clientId: number): Promise<BrandIdentityFile[]>;
  getBrandIdentityFile(id: number): Promise<BrandIdentityFile | undefined>;
  createBrandIdentityFile(file: InsertBrandIdentityFile): Promise<BrandIdentityFile>;
  deleteBrandIdentityFile(id: number): Promise<void>;

  getErrorReports(filters?: { status?: string; startDate?: Date; endDate?: Date }): Promise<ErrorReport[]>;
  createErrorReport(report: InsertErrorReport): Promise<ErrorReport>;
  updateErrorReport(id: number, updates: Partial<InsertErrorReport>): Promise<ErrorReport>;

  getWorkflowReportData(filters: {
    clientId?: number;
    cardType?: string;
    assignedUserId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any>;

  getBriefingTemplates(): Promise<BriefingTemplate[]>;
  getBriefingTemplate(id: number): Promise<BriefingTemplate | undefined>;
  createBriefingTemplate(template: InsertBriefingTemplate): Promise<BriefingTemplate>;
  updateBriefingTemplate(id: number, updates: Partial<InsertBriefingTemplate>): Promise<BriefingTemplate>;
  deleteBriefingTemplate(id: number): Promise<void>;

  getSystemSetting(key: string): Promise<string | undefined>;
  setSystemSetting(key: string, value: string): Promise<SystemSetting>;
  getSystemSettings(keys: string[]): Promise<Record<string, string>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

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

  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientBySlug(slug: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.slug, slug));
    return client;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  async updateClient(id: number, updates: UpdateClientRequest): Promise<Client> {
    const [updated] = await db.update(clients)
      .set(updates)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getClientCustomLinks(clientId: number): Promise<ClientCustomLink[]> {
    return await db.select().from(clientCustomLinks)
      .where(eq(clientCustomLinks.clientId, clientId))
      .orderBy(asc(clientCustomLinks.position));
  }

  async getClientCustomLink(id: number): Promise<ClientCustomLink | undefined> {
    const [link] = await db.select().from(clientCustomLinks).where(eq(clientCustomLinks.id, id));
    return link;
  }

  async createClientCustomLink(link: InsertClientCustomLink): Promise<ClientCustomLink> {
    const [created] = await db.insert(clientCustomLinks).values(link).returning();
    return created;
  }

  async updateClientCustomLink(id: number, updates: Partial<InsertClientCustomLink>): Promise<ClientCustomLink> {
    const [updated] = await db.update(clientCustomLinks)
      .set(updates)
      .where(eq(clientCustomLinks.id, id))
      .returning();
    return updated;
  }

  async deleteClientCustomLink(id: number): Promise<void> {
    await db.delete(clientCustomLinks).where(eq(clientCustomLinks.id, id));
  }

  async getPosts(): Promise<Post[]> {
    return await db.select().from(posts).orderBy(desc(posts.scheduledDate));
  }

  async getPost(id: number): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  async getPostsByClient(clientId: number): Promise<Post[]> {
    return await db.select().from(posts).where(eq(posts.clientId, clientId)).orderBy(desc(posts.scheduledDate));
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  async updatePost(id: number, updates: UpdatePostRequest): Promise<Post> {
    const [updated] = await db.update(posts)
      .set(updates)
      .where(eq(posts.id, id))
      .returning();
    return updated;
  }

  async deletePost(id: number): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  async getApprovalPosts(): Promise<ApprovalPost[]> {
    return await db.select().from(approvalPosts).orderBy(desc(approvalPosts.createdAt));
  }

  async getApprovalPost(id: number): Promise<ApprovalPost | undefined> {
    const [post] = await db.select().from(approvalPosts).where(eq(approvalPosts.id, id));
    return post;
  }

  async getApprovalPostsByClient(clientId: number): Promise<ApprovalPost[]> {
    return await db.select().from(approvalPosts).where(eq(approvalPosts.clientId, clientId)).orderBy(desc(approvalPosts.createdAt));
  }

  async getApprovalPostsByDesigner(designerId: number): Promise<ApprovalPost[]> {
    return await db.select().from(approvalPosts).where(eq(approvalPosts.designerId, designerId)).orderBy(desc(approvalPosts.createdAt));
  }

  async createApprovalPost(insertPost: InsertApprovalPost): Promise<ApprovalPost> {
    const [post] = await db.insert(approvalPosts).values(insertPost).returning();
    return post;
  }

  async updateApprovalPost(id: number, updates: UpdateApprovalPostRequest): Promise<ApprovalPost> {
    const [updated] = await db.update(approvalPosts)
      .set(updates)
      .where(eq(approvalPosts.id, id))
      .returning();
    return updated;
  }

  async deleteApprovalPost(id: number): Promise<void> {
    await db.delete(approvalPosts).where(eq(approvalPosts.id, id));
  }

  async getNotifications(recipientUserId?: number): Promise<Notification[]> {
    if (recipientUserId) {
      return await db.select().from(notifications)
        .where(eq(notifications.recipientUserId, recipientUserId))
        .orderBy(desc(notifications.createdAt));
    }
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async getNotificationsByClient(clientId: number): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.clientId, clientId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(notifications).values(notification).returning();
    return n;
  }

  async markNotificationRead(id: number): Promise<Notification> {
    const [n] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return n;
  }

  async markAllNotificationsRead(recipientUserId: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.recipientUserId, recipientUserId));
  }

  async markKanbanNotificationsRead(role: string, clientId?: number): Promise<void> {
    const kanbanTypes = ["approval_sent", "card_approved", "card_rejected", "revision_requested", "comment_added", "card_scheduled"];
    const conditions = [
      eq(notifications.isRead, false),
    ];
    if (role === "client" && clientId) {
      conditions.push(eq(notifications.recipientRole, "client"));
      conditions.push(eq(notifications.clientId, clientId));
    } else if (clientId) {
      conditions.push(eq(notifications.recipientRole, role));
      conditions.push(eq(notifications.clientId, clientId));
    } else {
      conditions.push(eq(notifications.recipientRole, role));
    }
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(...conditions, inArray(notifications.type, kanbanTypes)));
  }

  async markInsightNotificationsRead(role: string, clientId?: number): Promise<void> {
    const conditions = [
      eq(notifications.type, "insight"),
      eq(notifications.isRead, false),
    ];
    if (role === "client" && clientId) {
      conditions.push(eq(notifications.recipientRole, "client"));
      conditions.push(eq(notifications.clientId, clientId));
    } else {
      conditions.push(eq(notifications.recipientRole, role));
    }
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));
  }

  async getCompetitors(): Promise<Competitor[]> {
    return await db.select().from(competitors).orderBy(desc(competitors.createdAt));
  }

  async getCompetitorsByClient(clientId: number): Promise<Competitor[]> {
    return await db.select().from(competitors).where(eq(competitors.clientId, clientId)).orderBy(desc(competitors.createdAt));
  }

  async getCompetitor(id: number): Promise<Competitor | undefined> {
    const [comp] = await db.select().from(competitors).where(eq(competitors.id, id));
    return comp;
  }

  async createCompetitor(competitor: InsertCompetitor): Promise<Competitor> {
    const [comp] = await db.insert(competitors).values(competitor).returning();
    return comp;
  }

  async updateCompetitor(id: number, updates: Partial<InsertCompetitor>): Promise<Competitor> {
    const [comp] = await db.update(competitors).set(updates).where(eq(competitors.id, id)).returning();
    return comp;
  }

  async deleteCompetitor(id: number): Promise<void> {
    await db.delete(competitors).where(eq(competitors.id, id));
  }

  async getBriefings(): Promise<Briefing[]> {
    return await db.select().from(briefings).orderBy(desc(briefings.createdAt));
  }

  async getBriefingsByClient(clientId: number): Promise<Briefing[]> {
    return await db.select().from(briefings).where(eq(briefings.clientId, clientId)).orderBy(desc(briefings.createdAt));
  }

  async getBriefing(id: number): Promise<Briefing | undefined> {
    const [b] = await db.select().from(briefings).where(eq(briefings.id, id));
    return b;
  }

  async getBriefingByToken(token: string): Promise<Briefing | undefined> {
    const [b] = await db.select().from(briefings).where(eq(briefings.token, token));
    return b;
  }

  async createBriefing(briefing: InsertBriefing): Promise<Briefing> {
    const [b] = await db.insert(briefings).values(briefing).returning();
    return b;
  }

  async updateBriefing(id: number, updates: Partial<InsertBriefing>): Promise<Briefing> {
    const [b] = await db.update(briefings).set(updates).where(eq(briefings.id, id)).returning();
    return b;
  }

  async deleteBriefing(id: number): Promise<void> {
    await db.delete(briefings).where(eq(briefings.id, id));
  }

  async getKanbanColumnsByClient(clientId: number): Promise<KanbanColumn[]> {
    return await db.select().from(kanbanColumns).where(eq(kanbanColumns.clientId, clientId)).orderBy(asc(kanbanColumns.position));
  }

  async getKanbanColumn(id: number): Promise<KanbanColumn | undefined> {
    const [col] = await db.select().from(kanbanColumns).where(eq(kanbanColumns.id, id));
    return col;
  }

  async createKanbanColumn(col: InsertKanbanColumn): Promise<KanbanColumn> {
    const [c] = await db.insert(kanbanColumns).values(col).returning();
    return c;
  }

  async updateKanbanColumn(id: number, updates: Partial<InsertKanbanColumn>): Promise<KanbanColumn> {
    const [c] = await db.update(kanbanColumns).set(updates).where(eq(kanbanColumns.id, id)).returning();
    return c;
  }

  async deleteKanbanColumn(id: number): Promise<void> {
    await db.delete(kanbanCards).where(eq(kanbanCards.columnId, id));
    await db.delete(kanbanColumns).where(eq(kanbanColumns.id, id));
  }

  async reorderKanbanColumns(clientId: number, columnIds: number[]): Promise<void> {
    for (let i = 0; i < columnIds.length; i++) {
      await db.update(kanbanColumns).set({ position: i }).where(and(eq(kanbanColumns.id, columnIds[i]), eq(kanbanColumns.clientId, clientId)));
    }
  }

  async getKanbanCardsByColumn(columnId: number): Promise<KanbanCard[]> {
    return await db.select().from(kanbanCards).where(eq(kanbanCards.columnId, columnId)).orderBy(asc(kanbanCards.position));
  }

  async getKanbanCardsByClient(clientId: number): Promise<KanbanCard[]> {
    return await db.select().from(kanbanCards).where(eq(kanbanCards.clientId, clientId)).orderBy(asc(kanbanCards.position));
  }

  async getKanbanCard(id: number): Promise<KanbanCard | undefined> {
    const [c] = await db.select().from(kanbanCards).where(eq(kanbanCards.id, id));
    return c;
  }

  async createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard> {
    const [c] = await db.insert(kanbanCards).values(card).returning();
    return c;
  }

  async updateKanbanCard(id: number, updates: Partial<InsertKanbanCard>): Promise<KanbanCard> {
    const [c] = await db.update(kanbanCards).set(updates).where(eq(kanbanCards.id, id)).returning();
    return c;
  }

  async deleteKanbanCard(id: number): Promise<void> {
    await db.delete(kanbanComments).where(eq(kanbanComments.cardId, id));
    await db.delete(kanbanActivity).where(eq(kanbanActivity.cardId, id));
    await db.delete(kanbanTimeEntries).where(eq(kanbanTimeEntries.cardId, id));
    await db.delete(kanbanCards).where(eq(kanbanCards.id, id));
  }

  async getKanbanCardByApprovalPostId(approvalPostId: number): Promise<KanbanCard | undefined> {
    const [c] = await db.select().from(kanbanCards).where(eq(kanbanCards.approvalPostId, approvalPostId));
    return c;
  }

  async moveKanbanCard(cardId: number, toColumnId: number, newPosition: number): Promise<KanbanCard> {
    const [c] = await db.update(kanbanCards).set({ columnId: toColumnId, position: newPosition }).where(eq(kanbanCards.id, cardId)).returning();
    return c;
  }

  async getKanbanComments(cardId: number): Promise<KanbanComment[]> {
    return await db.select().from(kanbanComments).where(eq(kanbanComments.cardId, cardId)).orderBy(desc(kanbanComments.createdAt));
  }

  async createKanbanComment(comment: InsertKanbanComment): Promise<KanbanComment> {
    const [c] = await db.insert(kanbanComments).values(comment).returning();
    return c;
  }

  async deleteKanbanComment(id: number): Promise<void> {
    await db.delete(kanbanComments).where(eq(kanbanComments.id, id));
  }

  async getApprovedKanbanCards(): Promise<KanbanCard[]> {
    return await db.select().from(kanbanCards).where(eq(kanbanCards.approvalStatus, "Aprovado"));
  }

  async getScheduledKanbanCards(): Promise<{ card: KanbanCard; columnTitle: string }[]> {
    const allColumns = await db.select().from(kanbanColumns);
    const scheduledColumnIds = allColumns
      .filter(c => c.title === "Agendados" || c.title === "Agendamento")
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

  async getKanbanActivity(cardId: number): Promise<KanbanActivity[]> {
    return await db.select().from(kanbanActivity).where(eq(kanbanActivity.cardId, cardId)).orderBy(desc(kanbanActivity.createdAt));
  }

  async createKanbanActivity(activity: { cardId: number; userId: number | null; action: string; fromColumnId?: number; toColumnId?: number; details?: string }): Promise<KanbanActivity> {
    const [a] = await db.insert(kanbanActivity).values(activity).returning();
    return a;
  }

  async getKanbanTimeEntries(cardId: number): Promise<KanbanTimeEntry[]> {
    return await db.select().from(kanbanTimeEntries).where(eq(kanbanTimeEntries.cardId, cardId)).orderBy(desc(kanbanTimeEntries.startedAt));
  }

  async getOpenTimeEntry(cardId: number): Promise<KanbanTimeEntry | undefined> {
    const [entry] = await db.select().from(kanbanTimeEntries).where(and(eq(kanbanTimeEntries.cardId, cardId), isNull(kanbanTimeEntries.endedAt)));
    return entry;
  }

  async startTimeEntry(cardId: number, userId: number): Promise<KanbanTimeEntry> {
    const [entry] = await db.insert(kanbanTimeEntries).values({ cardId, userId, startedAt: new Date() }).returning();
    return entry;
  }

  async stopTimeEntry(entryId: number): Promise<KanbanTimeEntry> {
    const entry = await db.select().from(kanbanTimeEntries).where(eq(kanbanTimeEntries.id, entryId));
    if (!entry[0]) throw new Error("Time entry not found");
    const now = new Date();
    const totalSeconds = Math.floor((now.getTime() - new Date(entry[0].startedAt).getTime()) / 1000);
    const [updated] = await db.update(kanbanTimeEntries).set({ endedAt: now, totalSeconds }).where(eq(kanbanTimeEntries.id, entryId)).returning();
    return updated;
  }

  async getTimeEntriesByUser(userId: number, startDate?: Date, endDate?: Date): Promise<KanbanTimeEntry[]> {
    const conditions = [eq(kanbanTimeEntries.userId, userId)];
    return await db.select().from(kanbanTimeEntries).where(and(...conditions)).orderBy(desc(kanbanTimeEntries.startedAt));
  }

  async getUserClientAccess(userId: number): Promise<UserClientAccess[]> {
    return await db.select().from(userClientAccess).where(eq(userClientAccess.userId, userId));
  }

  async getClientAccessUsers(clientId: number): Promise<UserClientAccess[]> {
    return await db.select().from(userClientAccess).where(eq(userClientAccess.clientId, clientId));
  }

  async grantClientAccess(userId: number, clientId: number): Promise<UserClientAccess> {
    const existing = await db.select().from(userClientAccess).where(and(eq(userClientAccess.userId, userId), eq(userClientAccess.clientId, clientId)));
    if (existing.length > 0) return existing[0];
    const [entry] = await db.insert(userClientAccess).values({ userId, clientId }).returning();
    return entry;
  }

  async revokeClientAccess(userId: number, clientId: number): Promise<void> {
    await db.delete(userClientAccess).where(and(eq(userClientAccess.userId, userId), eq(userClientAccess.clientId, clientId)));
  }

  async revokeAllClientAccess(userId: number): Promise<void> {
    await db.delete(userClientAccess).where(eq(userClientAccess.userId, userId));
  }

  async getClientProducts(clientId: number): Promise<ClientProduct[]> {
    return await db.select().from(clientProducts).where(eq(clientProducts.clientId, clientId)).orderBy(asc(clientProducts.id));
  }
  async createClientProduct(product: InsertClientProduct): Promise<ClientProduct> {
    const [p] = await db.insert(clientProducts).values(product).returning();
    return p;
  }
  async updateClientProduct(id: number, updates: Partial<InsertClientProduct>): Promise<ClientProduct> {
    const [p] = await db.update(clientProducts).set(updates).where(eq(clientProducts.id, id)).returning();
    return p;
  }
  async deleteClientProduct(id: number): Promise<void> {
    await db.delete(clientProducts).where(eq(clientProducts.id, id));
  }

  async getClientServices(clientId: number): Promise<ClientService[]> {
    return await db.select().from(clientServices).where(eq(clientServices.clientId, clientId)).orderBy(asc(clientServices.id));
  }
  async createClientService(service: InsertClientService): Promise<ClientService> {
    const [s] = await db.insert(clientServices).values(service).returning();
    return s;
  }
  async updateClientService(id: number, updates: Partial<InsertClientService>): Promise<ClientService> {
    const [s] = await db.update(clientServices).set(updates).where(eq(clientServices.id, id)).returning();
    return s;
  }
  async deleteClientService(id: number): Promise<void> {
    await db.delete(clientServices).where(eq(clientServices.id, id));
  }

  async getClientCredentials(clientId: number): Promise<ClientCredential[]> {
    return await db.select().from(clientCredentials).where(eq(clientCredentials.clientId, clientId)).orderBy(asc(clientCredentials.id));
  }
  async createClientCredential(cred: InsertClientCredential): Promise<ClientCredential> {
    const [c] = await db.insert(clientCredentials).values(cred).returning();
    return c;
  }
  async updateClientCredential(id: number, updates: Partial<InsertClientCredential>): Promise<ClientCredential> {
    const [c] = await db.update(clientCredentials).set(updates).where(eq(clientCredentials.id, id)).returning();
    return c;
  }
  async deleteClientCredential(id: number): Promise<void> {
    await db.delete(clientCredentials).where(eq(clientCredentials.id, id));
  }

  async getClientInsights(clientId: number): Promise<ClientInsight[]> {
    return await db.select().from(clientInsights).where(eq(clientInsights.clientId, clientId)).orderBy(desc(clientInsights.createdAt));
  }
  async getAllClientInsights(): Promise<ClientInsight[]> {
    return await db.select().from(clientInsights).orderBy(desc(clientInsights.createdAt));
  }
  async createClientInsight(insight: InsertClientInsight): Promise<ClientInsight> {
    const [i] = await db.insert(clientInsights).values(insight).returning();
    return i;
  }
  async deleteClientInsight(id: number): Promise<void> {
    await db.delete(clientInsights).where(eq(clientInsights.id, id));
  }

  async getOnboardingAccess(clientId: number): Promise<ClientOnboardingAccess[]> {
    return await db.select().from(clientOnboardingAccess).where(eq(clientOnboardingAccess.clientId, clientId));
  }
  async setOnboardingAccess(clientId: number, userIds: number[]): Promise<void> {
    await db.delete(clientOnboardingAccess).where(eq(clientOnboardingAccess.clientId, clientId));
    if (userIds.length > 0) {
      await db.insert(clientOnboardingAccess).values(userIds.map(userId => ({ clientId, userId })));
    }
  }

  async getBrandIdentityFiles(clientId: number): Promise<BrandIdentityFile[]> {
    return await db.select().from(brandIdentityFiles).where(eq(brandIdentityFiles.clientId, clientId)).orderBy(desc(brandIdentityFiles.createdAt));
  }

  async getBrandIdentityFile(id: number): Promise<BrandIdentityFile | undefined> {
    const [f] = await db.select().from(brandIdentityFiles).where(eq(brandIdentityFiles.id, id));
    return f;
  }

  async createBrandIdentityFile(file: InsertBrandIdentityFile): Promise<BrandIdentityFile> {
    const [f] = await db.insert(brandIdentityFiles).values(file).returning();
    return f;
  }

  async deleteBrandIdentityFile(id: number): Promise<void> {
    await db.delete(brandIdentityFiles).where(eq(brandIdentityFiles.id, id));
  }

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

  async createErrorReport(report: InsertErrorReport): Promise<ErrorReport> {
    const [r] = await db.insert(errorReports).values(report).returning();
    return r;
  }

  async updateErrorReport(id: number, updates: Partial<InsertErrorReport>): Promise<ErrorReport> {
    const [r] = await db.update(errorReports).set(updates).where(eq(errorReports.id, id)).returning();
    return r;
  }

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

  async getBriefingTemplates(): Promise<BriefingTemplate[]> {
    return db.select().from(briefingTemplates).orderBy(desc(briefingTemplates.createdAt));
  }

  async getBriefingTemplate(id: number): Promise<BriefingTemplate | undefined> {
    const [template] = await db.select().from(briefingTemplates).where(eq(briefingTemplates.id, id));
    return template;
  }

  async createBriefingTemplate(template: InsertBriefingTemplate): Promise<BriefingTemplate> {
    const [created] = await db.insert(briefingTemplates).values(template).returning();
    return created;
  }

  async updateBriefingTemplate(id: number, updates: Partial<InsertBriefingTemplate>): Promise<BriefingTemplate> {
    const [updated] = await db.update(briefingTemplates).set(updates).where(eq(briefingTemplates.id, id)).returning();
    return updated;
  }

  async deleteBriefingTemplate(id: number): Promise<void> {
    await db.delete(briefingTemplates).where(eq(briefingTemplates.id, id));
  }

  async getSystemSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting?.value;
  }

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

export const storage = new DatabaseStorage();
