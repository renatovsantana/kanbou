import type { Express } from "express";
import type { Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { loginSchema, registerSchema, DEFAULT_KANBAN_COLUMNS, CONDITIONAL_COLUMNS, CONDITIONAL_COLUMN_POSITION, TIMED_COLUMNS, TIMER_EXCLUDED_COLUMNS, MANDATORY_FIRST_COLUMN, APPROVAL_STATUS_TO_COLUMN, PROTECTED_KANBAN_COLUMNS, insertClientProductSchema, insertClientServiceSchema, insertClientCredentialSchema, insertClientInsightSchema, isInternalRole, INTERNAL_ROLES } from "@shared/schema";
import { z } from "zod";
import { hashPassword, verifyPassword, requireAuth, requireRole, getCurrentUser } from "./auth";
import { registerLocalStorageRoutes } from "./local-storage";
import { createClientFolder, createApprovalSubfolder, uploadImageFromUrl, listDriveFiles, getDriveFileDownloadUrl, getDriveFileStream, listApprovalVersionFolders, isDriveConnected, getDriveUserInfo, uploadKanbanFileToDrive, listKanbanExtensionFolders, deleteDriveFile, resetOAuth2Client } from "./google-drive";
import multer from "multer";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

/** Multer instance configured with in-memory storage and 50MB file size limit */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
/** Directory path for storing generated thumbnails */
const THUMBNAILS_DIR = path.join(process.cwd(), "server", "thumbnails");
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

/** In-memory store tracking failed login attempts per IP for rate limiting */
const loginAttempts = new Map<string, { count: number; firstAttempt: number; blockedUntil: number }>();
/** Maximum number of login attempts allowed within the rate limit window */
const MAX_LOGIN_ATTEMPTS = 5;
/** Rate limit window duration in milliseconds (15 minutes) */
const WINDOW_MS = 15 * 60 * 1000;
/** Duration an IP is blocked after exceeding max login attempts (15 minutes) */
const BLOCK_DURATION_MS = 15 * 60 * 1000;

/** Periodically cleans up expired login attempt records every 60 seconds */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.firstAttempt > WINDOW_MS && now > data.blockedUntil) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 1000);

function parsePlatform(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw === "string") {
    if (raw === "Todas") return ["Instagram", "Facebook", "LinkedIn", "TikTok"];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
      if (typeof parsed === "string") return [parsed];
    } catch {}
    return [raw];
  }
  return [];
}

/**
 * Extracts the client IP address from the request.
 * Checks x-forwarded-for header for proxied requests.
 * @param req - Express request object
 * @returns The client's IP address string
 */
function getClientIp(req: any): string {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.connection?.remoteAddress || "unknown";
}

/**
 * Checks whether a given IP is allowed to attempt login based on rate limiting rules.
 * @param ip - The client IP address to check
 * @returns Object with `allowed` flag and optional `retryAfter` seconds
 */
function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const data = loginAttempts.get(ip);

  if (!data) return { allowed: true };

  if (now < data.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((data.blockedUntil - now) / 1000) };
  }

  if (now - data.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (data.count >= MAX_LOGIN_ATTEMPTS) {
    data.blockedUntil = now + BLOCK_DURATION_MS;
    return { allowed: false, retryAfter: Math.ceil(BLOCK_DURATION_MS / 1000) };
  }

  return { allowed: true };
}

/**
 * Records a failed login attempt for the given IP address.
 * Increments the attempt counter or initializes a new record.
 * @param ip - The client IP address
 */
function recordFailedLogin(ip: string) {
  const now = Date.now();
  const data = loginAttempts.get(ip);
  if (!data) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now, blockedUntil: 0 });
  } else {
    data.count++;
  }
}

/**
 * Clears all login attempt records for the given IP after a successful login.
 * @param ip - The client IP address
 */
function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

/**
 * Generates a WebP thumbnail from an image buffer and saves it to disk.
 * @param buffer - The raw image buffer
 * @param attachmentId - Unique identifier used as the thumbnail filename
 * @param width - Maximum thumbnail width (default: 300)
 * @param height - Maximum thumbnail height (default: 300)
 * @param quality - WebP compression quality (default: 60)
 * @returns The URL path to the generated thumbnail, or null on failure
 */
async function generateThumbnail(buffer: Buffer, attachmentId: string, width = 300, height = 300, quality = 60): Promise<string | null> {
  try {
    const thumbPath = path.join(THUMBNAILS_DIR, `${attachmentId}.webp`);
    await sharp(buffer)
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toFile(thumbPath);
    return `/api/thumbnails/${attachmentId}.webp`;
  } catch (err) {
    console.warn("Thumbnail generation failed:", err);
    return null;
  }
}

/**
 * Registers all API routes on the Express application.
 * Includes auth, user management, clients, posts, approvals, kanban, notifications,
 * briefings, settings, Google Drive integration, and file upload routes.
 * @param httpServer - The HTTP server instance
 * @param app - The Express application instance
 * @returns The HTTP server instance
 */
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === AUTH ROUTES ===

  /** POST /api/auth/register - Registers a new user. Requires admin role. Validates input with registerSchema. */
  app.post("/api/auth/register", requireRole("admin"), async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }
      const hashed = await hashPassword(input.password);
      const user = await storage.createUser({
        name: input.name,
        email: input.email,
        password: hashed,
        role: input.role,
        clientId: input.clientId ?? null,
        isActive: true,
      });
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  /** POST /api/auth/login - Authenticates a user with email/password. Applies rate limiting per IP. */
  app.post("/api/auth/login", async (req, res) => {
    try {
      const ip = getClientIp(req);
      const rateCheck = checkLoginRateLimit(ip);
      if (!rateCheck.allowed) {
        res.setHeader("Retry-After", String(rateCheck.retryAfter || 900));
        return res.status(429).json({
          message: `Muitas tentativas de login. Tente novamente em ${Math.ceil((rateCheck.retryAfter || 900) / 60)} minutos.`
        });
      }

      const input = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(input.email);
      if (!user) {
        recordFailedLogin(ip);
        return res.status(401).json({ message: "Email ou senha inválidos" });
      }
      if (!user.isActive) {
        recordFailedLogin(ip);
        return res.status(401).json({ message: "Conta desativada" });
      }
      const valid = await verifyPassword(input.password, user.password);
      if (!valid) {
        recordFailedLogin(ip);
        return res.status(401).json({ message: "Email ou senha inválidos" });
      }
      clearLoginAttempts(ip);
      (req as any).session.userId = user.id;
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  /** POST /api/auth/logout - Destroys the user session and clears the session cookie. */
  app.post("/api/auth/logout", (req, res) => {
    (req as any).session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao sair" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logout realizado" });
    });
  });

  /** GET /api/auth/me - Returns the currently authenticated user (without password). */
  app.get("/api/auth/me", async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  // === USER MANAGEMENT (admin only) ===

  /** GET /api/users - Lists all users. Requires auth + internal role or manager. Returns users without passwords. */
  app.get("/api/users", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    if (!isInternalRole(user.role) && !user.isManager) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const allUsers = await storage.getUsers();
    const safeUsers = allUsers.map(({ password: _, ...u }) => u);
    res.json(safeUsers);
  });

  /** POST /api/users - Creates a new user. Requires admin role. Hashes password before storing. */
  app.post("/api/users", requireRole("admin"), async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }
      const hashed = await hashPassword(input.password);
      const user = await storage.createUser({
        name: input.name,
        email: input.email,
        password: hashed,
        role: input.role,
        clientId: input.clientId ?? null,
        isManager: input.isManager ?? false,
        isActive: true,
      });
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  /** PUT /api/users/:id - Updates a user by ID. Requires admin role. Hashes password if provided. */
  app.put("/api/users/:id", requireRole("admin"), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getUser(id);
    if (!existing) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const updates: any = { ...req.body };
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    } else {
      delete updates.password;
    }
    const updated = await storage.updateUser(id, updates);
    const { password: _, ...safeUser } = updated;
    res.json(safeUser);
  });

  /** DELETE /api/users/:id - Deletes a user by ID. Requires admin role. Prevents self-deletion. */
  app.delete("/api/users/:id", requireRole("admin"), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getUser(id);
    if (!existing) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const currentUser = await getCurrentUser(req);
    if (currentUser && currentUser.id === id) {
      return res.status(400).json({ message: "Não é possível excluir seu próprio usuário" });
    }
    await storage.deleteUser(id);
    res.status(204).send();
  });

  // === USER-CLIENT ACCESS ROUTES ===

  /** GET /api/users/:id/client-access - Returns list of client IDs a user has access to. Requires admin or manager. */
  app.get("/api/users/:id/client-access", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    if (user.role !== "admin" && !user.isManager) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const userId = Number(req.params.id);
    const access = await storage.getUserClientAccess(userId);
    res.json(access.map(a => a.clientId));
  });

  /** PUT /api/users/:id/client-access - Replaces user's client access list. Requires admin or manager. Body: { clientIds: number[] } */
  app.put("/api/users/:id/client-access", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    if (user.role !== "admin" && !user.isManager) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const userId = Number(req.params.id);
    const { clientIds } = req.body as { clientIds: number[] };
    if (!Array.isArray(clientIds)) {
      return res.status(400).json({ message: "clientIds deve ser um array" });
    }
    await storage.revokeAllClientAccess(userId);
    for (const clientId of clientIds) {
      await storage.grantClientAccess(userId, clientId);
    }
    res.json({ success: true, clientIds });
  });

  // === CLIENT ROUTES ===

  /** GET /api/clients - Lists clients. Filters by user role: clients see only their own, non-admin internal users see their allowed clients. */
  app.get(api.clients.list.path, requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    let allClients = await storage.getClients();
    if (user && user.role === "client") {
      if (user.clientId) {
        allClients = allClients.filter(c => c.id === user.clientId);
      } else {
        allClients = [];
      }
    } else if (user && user.role !== "admin") {
      const access = await storage.getUserClientAccess(user.id);
      if (access.length > 0) {
        const allowedIds = new Set(access.map(a => a.clientId));
        allClients = allClients.filter(c => allowedIds.has(c.id));
      }
    }
    res.json(allClients);
  });

  /** GET /api/clients/:id - Returns a single client by ID. Client users can only access their own client. */
  app.get(api.clients.get.path, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const user = await getCurrentUser(req);
    if (user?.role === "client" && user.clientId !== id) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const client = await storage.getClient(id);
    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    res.json(client);
  });

  /** POST /api/clients - Creates a new client with default kanban columns and a Google Drive folder. Requires admin role. */
  app.post(api.clients.create.path, requireRole("admin"), async (req, res) => {
    try {
      const input = api.clients.create.input.parse(req.body);
      const client = await storage.createClient(input);

      for (let i = 0; i < DEFAULT_KANBAN_COLUMNS.length; i++) {
        await storage.createKanbanColumn({
          clientId: client.id,
          title: DEFAULT_KANBAN_COLUMNS[i],
          position: i,
          isDefault: true,
        });
      }

      try {
        const driveResult = await createClientFolder(client.name, client.id);
        const updated = await storage.updateClient(client.id, {
          driveFolderId: driveResult.folderId,
          driveFolderUrl: driveResult.folderUrl,
        });
        res.status(201).json(updated);
      } catch (driveErr) {
        console.warn("Google Drive folder creation failed (client still created):", driveErr);
        res.status(201).json(client);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.clients.update.path, requireRole("admin"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getClient(id);
      if (!existing) {
        return res.status(404).json({ message: 'Cliente não encontrado' });
      }
      const input = api.clients.update.input.parse(req.body);
      const updated = await storage.updateClient(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  /** DELETE /api/clients/:id - Deletes a client by ID. Requires admin role. Prevents deletion if client has linked posts. */
  app.delete(api.clients.delete.path, requireRole("admin"), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getClient(id);
    if (!existing) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }
    const allPosts = await storage.getPosts();
    const clientPosts = allPosts.filter(p => p.clientId === id);
    if (clientPosts.length > 0) {
      return res.status(400).json({
        message: `Este cliente possui ${clientPosts.length} post(s) vinculado(s). Remova ou reatribua os posts antes de excluir.`
      });
    }
    await storage.deleteClient(id);
    res.status(204).send();
  });

  // === POST ROUTES ===

  /** GET /api/posts - Lists posts. Client users see only their client's posts. Supports ?client=ID query filter. */
  app.get(api.posts.list.path, requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });

    let allPosts;
    if (user.role === "client" && user.clientId) {
      allPosts = await storage.getPostsByClient(user.clientId);
    } else if (req.query.client) {
      allPosts = await storage.getPostsByClient(Number(req.query.client));
    } else {
      allPosts = await storage.getPosts();
    }
    res.json(allPosts);
  });

  app.get(api.posts.get.path, requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    const post = await storage.getPost(Number(req.params.id));
    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado' });
    }
    if (user?.role === "client" && user.clientId && post.clientId !== user.clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    res.json(post);
  });

  /** POST /api/posts - Creates a new post. Requires internal role. Normalizes platform string to array. */
  app.post(api.posts.create.path, requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      if (req.body.platform != null) {
        req.body.platform = parsePlatform(req.body.platform);
      }
      const input = api.posts.create.input.parse(req.body);
      const post = await storage.createPost(input);
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  /** PUT /api/posts/:id - Updates an existing post by ID. Requires internal role. Normalizes platform string to array. */
  app.put(api.posts.update.path, requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existingPost = await storage.getPost(id);
      if (!existingPost) {
        return res.status(404).json({ message: 'Post não encontrado' });
      }
      if (req.body.platform != null) {
        req.body.platform = parsePlatform(req.body.platform);
      }
      const input = api.posts.update.input.parse(req.body);
      const updatedPost = await storage.updatePost(id, input);
      res.json(updatedPost);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  /** DELETE /api/posts/:id - Deletes a post by ID. Requires admin role. */
  app.delete(api.posts.delete.path, requireRole("admin"), async (req, res) => {
    const id = Number(req.params.id);
    const existingPost = await storage.getPost(id);
    if (!existingPost) {
      return res.status(404).json({ message: 'Post não encontrado' });
    }
    await storage.deletePost(id);
    res.status(204).send();
  });

  async function syncApprovalToKanban(approvalId: number, clientId: number, title: string, status: string, imageUrl?: string, userId?: number | null) {
    const targetColumnTitle = APPROVAL_STATUS_TO_COLUMN[status];
    if (!targetColumnTitle) return;

    let columns = await storage.getKanbanColumnsByClient(clientId);
    if (columns.length === 0) {
      for (let i = 0; i < DEFAULT_KANBAN_COLUMNS.length; i++) {
        await storage.createKanbanColumn({ clientId, title: DEFAULT_KANBAN_COLUMNS[i], position: i, isDefault: true });
      }
      columns = await storage.getKanbanColumnsByClient(clientId);
    }

    const targetColumn = columns.find(c => c.title === targetColumnTitle);
    if (!targetColumn) return;

    const existingCard = await storage.getKanbanCardByApprovalPostId(approvalId);

    if (existingCard) {
      if (existingCard.columnId !== targetColumn.id) {
        const oldColumn = columns.find(c => c.id === existingCard.columnId);
        await storage.moveKanbanCard(existingCard.id, targetColumn.id, 0);
        await storage.createKanbanActivity({
          cardId: existingCard.id,
          userId: userId ?? null,
          action: "moved",
          fromColumnId: existingCard.columnId,
          toColumnId: targetColumn.id,
          details: `Movido automaticamente: status "${status}" → coluna "${targetColumnTitle}"`,
        });

        if (oldColumn && !TIMER_EXCLUDED_COLUMNS.includes(oldColumn.title)) {
          const openEntry = await storage.getOpenTimeEntry(existingCard.id);
          if (openEntry) await storage.stopTimeEntry(openEntry.id);
        }
        if (!TIMER_EXCLUDED_COLUMNS.includes(targetColumnTitle) && userId) {
          await storage.startTimeEntry(existingCard.id, userId, targetColumn.id);
        }
      }
    } else {
      const colCards = await storage.getKanbanCardsByColumn(targetColumn.id);
      const maxPos = colCards.length > 0 ? Math.max(...colCards.map(c => c.position)) + 1 : 0;
      const card = await storage.createKanbanCard({
        columnId: targetColumn.id,
        clientId,
        title: `[Aprovação] ${title}`,
        description: `Cartão vinculado ao post de aprovação "${title}"`,
        coverUrl: imageUrl || null,
        position: maxPos,
        approvalPostId: approvalId,
        createdBy: userId ?? null,
      });
      await storage.createKanbanActivity({
        cardId: card.id,
        userId: userId ?? null,
        action: "created",
        details: `Cartão criado automaticamente a partir da aprovação "${title}"`,
      });
    }
  }

  // === APPROVAL POST ROUTES ===

  /** GET /api/approvals - Lists approval posts. Filtered by role: clients see their own, designers see assigned, admins see all. */
  app.get(api.approvals.list.path, requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });

    let approvals;
    if (user.role === "client" && user.clientId) {
      approvals = await storage.getApprovalPostsByClient(user.clientId);
    } else if (isInternalRole(user.role) && user.role !== "admin") {
      approvals = await storage.getApprovalPostsByDesigner(user.id);
    } else {
      approvals = await storage.getApprovalPosts();
    }
    res.json(approvals);
  });

  /** GET /api/approvals/stats/by-client - Returns revision and pending counts grouped by client ID. Requires auth. */
  app.get("/api/approvals/stats/by-client", requireAuth, async (req, res) => {
    const allApprovals = await storage.getApprovalPosts();
    const stats: Record<number, { revisao: number; pendente: number }> = {};
    allApprovals.forEach((ap) => {
      if (ap.clientId) {
        if (!stats[ap.clientId]) stats[ap.clientId] = { revisao: 0, pendente: 0 };
        if (ap.status === "Revisão") stats[ap.clientId].revisao++;
        if (ap.status === "Pendente") stats[ap.clientId].pendente++;
      }
    });
    res.json(stats);
  });

  /** GET /api/approvals/approved - Returns all approval posts with status "Aprovado". Requires internal role. */
  app.get("/api/approvals/approved", requireRole(...INTERNAL_ROLES), async (_req, res) => {
    const allApprovals = await storage.getApprovalPosts();
    const approved = allApprovals.filter(a => a.status === "Aprovado");
    res.json(approved);
  });

  /** GET /api/kanban/approved-cards - Returns approved kanban cards with template data, attachments, and scheduling status. Requires internal role. */
  app.get("/api/kanban/approved-cards", requireRole(...INTERNAL_ROLES), async (_req, res) => {
    try {
      const allCards = await storage.getApprovedKanbanCards();
      const allClients = await storage.getClients();
      const clientMap = new Map(allClients.map(c => [c.id, c.name]));

      const existingPosts = await storage.getPosts();
      const scheduledCardIds = new Set(
        existingPosts
          .filter(p => p.notes && p.notes.includes("Importado do Kanban - Card #"))
          .map(p => {
            const match = p.notes?.match(/Card #(\d+)/);
            return match ? Number(match[1]) : null;
          })
          .filter(Boolean)
      );

      const result = allCards.map(card => {
        let templateObj: Record<string, string> = {};
        try { if (card.templateData) templateObj = JSON.parse(card.templateData as string); } catch {}

        let attachmentsList: any[] = [];
        try { if (card.attachments) attachmentsList = JSON.parse(card.attachments as string); } catch {}

        return {
          id: card.id,
          title: templateObj.postTitle || templateObj.headline || card.title,
          clientId: card.clientId,
          clientName: clientMap.get(card.clientId) || "Cliente",
          cardType: card.cardType,
          caption: templateObj.caption || card.description || "",
          platform: templateObj.platform || null,
          publishDate: templateObj.publishDate || null,
          hashtags: templateObj.hashtags || null,
          imageUrl: card.coverUrl || (attachmentsList[0]?.thumbnailUrl) || null,
          attachments: attachmentsList,
          alreadyScheduled: scheduledCardIds.has(card.id),
          createdAt: card.createdAt,
        };
      });

      res.json(result);
    } catch (err) {
      console.error("Error getting approved kanban cards:", err);
      res.status(500).json({ message: "Erro ao buscar cards aprovados" });
    }
  });

  /** GET /api/approvals/:id - Returns a single approval post by ID. Requires auth. */
  app.get(api.approvals.get.path, requireAuth, async (req, res) => {
    const approval = await storage.getApprovalPost(Number(req.params.id));
    if (!approval) {
      return res.status(404).json({ message: 'Postagem não encontrada' });
    }
    res.json(approval);
  });

  /** POST /api/approvals - Creates a new approval post. Requires internal role. Uploads images to Google Drive and syncs to kanban. */
  app.post(api.approvals.create.path, requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      const body = { ...req.body };
      if (user && isInternalRole(user.role) && user.role !== "admin") {
        body.designerId = user.id;
      }
      const input = api.approvals.create.input.parse(body);

      if (input.parentId) {
        const parentPost = await storage.getApprovalPost(input.parentId);
        if (parentPost && (parentPost.status === "Revisão" || parentPost.status === "Revisado")) {
          await storage.updateApprovalPost(input.parentId, { status: "Refeito" });
        }
      }

      const approval = await storage.createApprovalPost(input);

      if (input.clientId) {
        try {
          const client = await storage.getClient(input.clientId);
          if (client?.driveFolderId) {
            const version = input.version || 1;
            const driveFolder = await createApprovalSubfolder(client.driveFolderId, input.title, version);

            const imageUrls = (input.imageUrls?.length ? input.imageUrls : [input.imageUrl]).filter(Boolean);
            if (imageUrls.length === 0) {
              return res.status(201).json(approval);
            }
            const driveFiles: Array<{ fileId: string; fileUrl: string; downloadUrl: string; fileName: string }> = [];

            const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
            for (let i = 0; i < imageUrls.length; i++) {
              try {
                const imgUrl = imageUrls[i];
                if (!imgUrl.startsWith('/objects/') && !imgUrl.startsWith('/uploads/') && !imgUrl.startsWith(baseUrl)) {
                  console.warn(`Skipping non-local image URL: ${imgUrl}`);
                  continue;
                }
                const fullUrl = imgUrl.startsWith('http') ? imgUrl : `${baseUrl}${imgUrl}`;
                const ext = imgUrl.split('.').pop()?.split('?')[0] || 'png';
                const fileName = `${input.title}_${version > 1 ? `v${version}_` : ''}${i + 1}.${ext}`;
                const uploaded = await uploadImageFromUrl(driveFolder.folderId, fullUrl, fileName);
                driveFiles.push({ ...uploaded, fileName });
              } catch (uploadErr) {
                console.warn(`Failed to upload image ${i + 1} to Drive:`, uploadErr);
              }
            }

            await storage.updateApprovalPost(approval.id, {
              driveFolderId: driveFolder.folderId,
              driveFolderUrl: driveFolder.folderUrl,
              driveFileIds: JSON.stringify(driveFiles),
            });

            const updatedApproval = await storage.getApprovalPost(approval.id);

            try {
              if (updatedApproval && updatedApproval.clientId) {
                await syncApprovalToKanban(updatedApproval.id, updatedApproval.clientId, updatedApproval.title, updatedApproval.status, updatedApproval.imageUrl, user?.id);
              }
            } catch (syncErr) {
              console.warn("Kanban sync failed:", syncErr);
            }

            return res.status(201).json(updatedApproval);
          }
        } catch (driveErr) {
          console.warn("Drive subfolder/upload failed:", driveErr);
        }
      }

      try {
        if (approval.clientId) {
          await syncApprovalToKanban(approval.id, approval.clientId, approval.title, approval.status, approval.imageUrl, user?.id);
        }
      } catch (syncErr) {
        console.warn("Kanban sync failed:", syncErr);
      }

      res.status(201).json(approval);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  /** PUT /api/approvals/:id - Updates an approval post. Client users can only update allowed fields (status, observations, etc.). Syncs status changes to kanban. */
  app.put(api.approvals.update.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getApprovalPost(id);
      if (!existing) {
        return res.status(404).json({ message: 'Postagem não encontrada' });
      }
      const user = await getCurrentUser(req);
      if (user?.role === "client") {
        if (!user.clientId || existing.clientId !== user.clientId) {
          return res.status(403).json({ message: "Sem permissão para editar esta postagem" });
        }
        const allowedFields = ["status", "observations", "captionSuggestion", "annotations"];
        const updates: any = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
          }
        }
        const updated = await storage.updateApprovalPost(id, updates);

        if (updates.status === "Revisão" && existing.status !== "Revisão") {
          await storage.createNotification({
            clientId: existing.clientId,
            approvalPostId: id,
            type: "revisao",
            message: `Post "${existing.title}" precisa de revisão`,
            recipientRole: "admin",
          });
        }

        if (updates.status && updates.status !== existing.status && updated.clientId) {
          try {
            await syncApprovalToKanban(updated.id, updated.clientId, updated.title, updated.status, updated.imageUrl, user?.id);
          } catch (syncErr) {
            console.warn("Kanban sync failed:", syncErr);
          }
        }

        return res.json(updated);
      }
      const input = api.approvals.update.input.parse(req.body);
      const { annotations: _ann, captionSuggestion: _cs, observations: _obs, status: reqStatus, ...adminUpdates } = input;
      if (reqStatus === "Revisado" && existing.status === "Revisão") {
        (adminUpdates as any).status = "Revisado";
      }
      if (Object.keys(adminUpdates).length === 0) {
        return res.json(existing);
      }
      const updated = await storage.updateApprovalPost(id, adminUpdates);

      if ((adminUpdates as any).status && (adminUpdates as any).status !== existing.status && updated.clientId) {
        try {
          await syncApprovalToKanban(updated.id, updated.clientId, updated.title, updated.status, updated.imageUrl, user?.id);
        } catch (syncErr) {
          console.warn("Kanban sync failed:", syncErr);
        }
      }

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  /** DELETE /api/approvals/:id - Deletes an approval post. Client users can only delete their own client's posts. */
  app.delete(api.approvals.delete.path, requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getApprovalPost(id);
    if (!existing) {
      return res.status(404).json({ message: 'Postagem não encontrada' });
    }
    const currentUser = await getCurrentUser(req);
    if (currentUser?.role === "client") {
      if (existing.clientId !== currentUser?.clientId) {
        return res.status(403).json({ message: 'Sem permissão para excluir esta postagem' });
      }
    }
    await storage.deleteApprovalPost(id);
    res.status(204).send();
  });

  // === IMPORT APPROVED POSTS TO SCHEDULING ===

  /** POST /api/posts/import-approval - Imports an approved approval post as a scheduled post. Fetches Drive download URLs if available. Requires internal role. */
  app.post("/api/posts/import-approval", requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const importSchema = z.object({
        approvalPostId: z.number({ required_error: "ID da aprovação é obrigatório" }),
        scheduledDate: z.string().optional(),
        platform: z.array(z.string()).optional(),
        content: z.string().optional(),
        status: z.enum(["Agendado"]).optional(),
        notes: z.string().optional(),
      });
      const parsed = importSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Dados inválidos" });
      }
      const { approvalPostId, scheduledDate, platform, content, status, notes } = parsed.data;
      const approval = await storage.getApprovalPost(approvalPostId);
      if (!approval) {
        return res.status(404).json({ message: "Aprovação não encontrada" });
      }
      if (approval.status !== "Aprovado") {
        return res.status(400).json({ message: "Somente posts aprovados podem ser importados" });
      }
      let driveDownloadUrls: string[] | null = null;
      if (approval.driveFileIds) {
        try {
          const driveFiles = JSON.parse(approval.driveFileIds);
          if (Array.isArray(driveFiles) && driveFiles.length > 0) {
            driveDownloadUrls = driveFiles.map((f: any) => f.downloadUrl).filter(Boolean);
          }
        } catch { }
      }
      if ((!driveDownloadUrls || driveDownloadUrls.length === 0) && approval.driveFolderId) {
        try {
          const driveFiles = await listDriveFiles(approval.driveFolderId);
          if (driveFiles.length > 0) {
            driveDownloadUrls = driveFiles.map(f => f.downloadUrl).filter(Boolean);
          }
        } catch { }
      }

      const post = await storage.createPost({
        clientId: approval.clientId,
        clientName: approval.clientName,
        title: approval.title,
        content: content || approval.caption || "",
        platform: platform && platform.length > 0 ? platform : (approval.platform || ["Instagram"]),
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        status: status || "Agendado",
        mediaUrl: approval.imageUrl,
        mediaUrls: driveDownloadUrls && driveDownloadUrls.length > 0 ? driveDownloadUrls : (approval.imageUrls || null),
        approvalPostId: approval.id,
        notes: notes || `Importado da aprovação #${approval.id}`,
      });
      res.status(201).json(post);
    } catch (err) {
      throw err;
    }
  });

  /** POST /api/posts/import-kanban-card - Imports an approved kanban card as a scheduled post and moves the card to "Agendados" column. Requires internal role. */
  app.post("/api/posts/import-kanban-card", requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const importSchema = z.object({
        kanbanCardId: z.number({ required_error: "ID do card é obrigatório" }),
        scheduledDate: z.string(),
        platform: z.array(z.string()).min(1, "Selecione ao menos uma plataforma"),
        content: z.string().optional(),
        status: z.enum(["Agendado"]).optional(),
        notes: z.string().optional(),
      });
      const parsed = importSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Dados inválidos" });
      }

      const { kanbanCardId, scheduledDate, platform, content, status, notes } = parsed.data;
      const card = await storage.getKanbanCard(kanbanCardId);
      if (!card) return res.status(404).json({ message: "Card não encontrado" });
      if (card.approvalStatus !== "Aprovado") return res.status(400).json({ message: "Somente cards aprovados podem ser agendados" });

      const client = await storage.getClient(card.clientId);
      const clientName = client?.name || "Cliente";

      let templateObj: Record<string, string> = {};
      try { if (card.templateData) templateObj = JSON.parse(card.templateData as string); } catch {}

      let mediaUrl: string | null = null;
      let mediaUrls: string[] | null = null;
      if (card.attachments) {
        try {
          const attachments = JSON.parse(card.attachments as string);
          if (Array.isArray(attachments) && attachments.length > 0) {
            mediaUrl = attachments[0].driveUrl || attachments[0].url || null;
            mediaUrls = attachments.map((a: any) => a.driveUrl || a.url).filter(Boolean);
          }
        } catch {}
      }

      const postTitle = templateObj.postTitle || templateObj.headline || card.title;
      const postNotes = [
        notes || "",
        templateObj.hashtags ? `Hashtags: ${templateObj.hashtags}` : "",
        `Importado do Kanban - Card #${card.id}`,
      ].filter(Boolean).join("\n");

      const post = await storage.createPost({
        clientId: card.clientId,
        clientName: clientName,
        title: postTitle,
        content: content || templateObj.caption || card.description || "",
        platform: platform,
        scheduledDate: new Date(scheduledDate),
        status: status || "Agendado",
        mediaUrl: mediaUrl,
        mediaUrls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : null,
        kanbanCardId: kanbanCardId,
        notes: postNotes,
      });

      const user = await getCurrentUser(req);
      await moveCardToColumn(card, "Agendados", user?.id ?? null);

      await storage.createNotification({
        clientId: card.clientId,
        type: "card_scheduled",
        message: `Card "${card.title}" foi agendado para publicação`,
        recipientRole: "client",
      });

      res.status(201).json(post);
    } catch (err) {
      console.error("Error importing kanban card to post:", err);
      res.status(500).json({ message: "Erro ao importar card para posts" });
    }
  });

  /** GET /api/kanban/scheduled-cards - Returns all kanban cards with dates (publishDate/deadline) for calendar view. Requires auth. */
  app.get("/api/kanban/scheduled-cards", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const calendarData = await storage.getCalendarKanbanCards();

      let filtered = calendarData;
      if (user.role === "client" && user.clientId) {
        filtered = calendarData.filter(d => d.card.clientId === user.clientId);
      }

      const allClients = await storage.getClients();
      const clientMap = new Map(allClients.map(c => [c.id, c.name]));

      const allPosts = await storage.getPosts();
      const postKanbanIds = new Set(allPosts.filter(p => p.kanbanCardId).map(p => p.kanbanCardId));

      const COLUMN_STATUS_MAP: Record<string, string> = {
        "Fila": "Na Fila",
        "Desenvolvendo Design": "Em Produção",
        "Revisar Criação": "Em Produção",
        "Finalizado Copy": "Em Produção",
        "Desenvolvendo Copy": "Em Produção",
        "Em Aprovação": "Em Aprovação",
        "Tráfego e RDS": "Em Aprovação",
        "Revisão": "Revisão",
        "Aprovados": "Aprovado",
        "Reprovados": "Reprovado",
        "Agendamento": "Aguardando Agendar",
        "Agendados": "Agendado",
        "Postados": "Postado",
        "Finalizados": "Finalizado",
      };

      const result: any[] = [];
      for (const { card, columnTitle } of filtered) {
        if (postKanbanIds.has(card.id)) continue;

        let templateObj: Record<string, string> = {};
        try { if (card.templateData) templateObj = JSON.parse(card.templateData as string); } catch {}

        const scheduledDate = templateObj.publishDate || templateObj.deadline;
        if (!scheduledDate) continue;

        const platforms = parsePlatform(templateObj.platform);
        const status = COLUMN_STATUS_MAP[columnTitle] || columnTitle;

        result.push({
          id: `kanban-${card.id}`,
          kanbanCardId: card.id,
          title: card.title,
          clientId: card.clientId,
          clientName: clientMap.get(card.clientId) || "Cliente",
          content: templateObj.caption || card.description || "",
          platform: platforms,
          scheduledDate,
          scheduledTime: templateObj.publishTime || null,
          status,
          columnTitle,
          cardType: card.cardType,
          source: "kanban" as const,
        });
      }

      res.json(result);
    } catch (err) {
      console.error("Error getting calendar kanban cards:", err);
      res.status(500).json({ message: "Erro ao buscar cards do calendário" });
    }
  });

  // === NOTIFICATIONS ROUTES ===

  /** GET /api/notifications - Returns notifications filtered by user role and client. Requires auth. */
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const allNotifications = await storage.getNotifications();
    const filtered = allNotifications.filter(n => {
      if (n.recipientUserId === user.id) return true;
      if (isInternalRole(user.role) && (!n.recipientRole || n.recipientRole === "admin" || n.recipientRole === "designer" || n.recipientRole === "all")) return true;
      if (user.role === "client" && n.recipientRole === "client" && n.clientId && user.clientId === n.clientId) return true;
      if (n.recipientRole === "all") return true;
      return false;
    });
    res.json(filtered);
  });

  /** GET /api/notifications/unread-count - Returns count of unread notifications for the current user. Requires auth. */
  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const allNotifications = await storage.getNotifications();
    const filtered = allNotifications.filter(n => {
      if (n.isRead) return false;
      if (n.recipientUserId === user.id) return true;
      if (isInternalRole(user.role) && (!n.recipientRole || n.recipientRole === "admin" || n.recipientRole === "designer" || n.recipientRole === "all")) return true;
      if (user.role === "client" && n.recipientRole === "client" && n.clientId && user.clientId === n.clientId) return true;
      if (n.recipientRole === "all") return true;
      return false;
    });
    res.json({ count: filtered.length });
  });

  /** PUT /api/notifications/:id/read - Marks a single notification as read by ID. Requires auth. */
  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.markNotificationRead(id);
    res.json(updated);
  });

  /** PUT /api/notifications/read-kanban - Marks all kanban-related notifications as read for the current user. Requires auth. */
  app.put("/api/notifications/read-kanban", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const clientId = req.body.clientId ? Number(req.body.clientId) : (user.clientId ?? undefined);
    await storage.markKanbanNotificationsRead(user.role, clientId);
    res.json({ success: true });
  });

  /** PUT /api/notifications/read-insights - Marks all insight-related notifications as read for the current user. Requires auth. */
  app.put("/api/notifications/read-insights", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    await storage.markInsightNotificationsRead(user.role, user.clientId ?? undefined);
    res.json({ success: true });
  });

  /** PUT /api/notifications/read-all - Marks all notifications as read for the current user. Requires auth. */
  app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    await storage.markAllNotificationsRead(user.role, user.clientId ?? undefined);
    res.json({ success: true });
  });

  /** PUT /api/notifications/read-by-card/:cardId - Marks all notifications for a specific kanban card as read. Requires auth. */
  app.put("/api/notifications/read-by-card/:cardId", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const cardId = Number(req.params.cardId);
    if (isNaN(cardId)) return res.status(400).json({ message: "ID inválido" });
    await storage.markCardNotificationsRead(cardId, user.role, user.clientId ?? undefined);
    res.json({ success: true });
  });

  // === COMPETITORS ===

  /** GET /api/competitors - Lists competitors. Client users see only their client's competitors. Requires auth. */
  app.get("/api/competitors", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    if (user.role === "client" && user.clientId) {
      const comps = await storage.getCompetitorsByClient(user.clientId);
      return res.json(comps);
    }
    const comps = await storage.getCompetitors();
    res.json(comps);
  });

  /** GET /api/competitors/by-client/:clientId - Returns competitors for a specific client. Client users can only view their own. Requires auth. */
  app.get("/api/competitors/by-client/:clientId", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = await getCurrentUser(req);
    if (user?.role === "client" && user.clientId !== clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const comps = await storage.getCompetitorsByClient(clientId);
    res.json(comps);
  });

  /** POST /api/competitors - Creates a new competitor. Client users auto-assign their clientId. Requires internal role or client role. */
  app.post("/api/competitors", requireRole(...INTERNAL_ROLES, "client"), async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      const data = req.body;
      if (user?.role === "client" && user.clientId) {
        data.clientId = user.clientId;
      }
      const comp = await storage.createCompetitor(data);
      res.status(201).json(comp);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Erro ao criar concorrente" });
    }
  });

  /** PUT /api/competitors/:id - Updates a competitor. Client users can only update their own client's competitors. */
  app.put("/api/competitors/:id", requireRole(...INTERNAL_ROLES, "client"), async (req, res) => {
    const user = await getCurrentUser(req);
    if (user?.role === "client") {
      const comp = await storage.getCompetitor(Number(req.params.id));
      if (comp && comp.clientId !== user.clientId) {
        return res.status(403).json({ message: "Sem permissão" });
      }
    }
    const comp = await storage.updateCompetitor(Number(req.params.id), req.body);
    res.json(comp);
  });

  /** DELETE /api/competitors/:id - Deletes a competitor. Client users can only delete their own client's competitors. */
  app.delete("/api/competitors/:id", requireRole(...INTERNAL_ROLES, "client"), async (req, res) => {
    const user = await getCurrentUser(req);
    if (user?.role === "client") {
      const comp = await storage.getCompetitor(Number(req.params.id));
      if (comp && comp.clientId !== user.clientId) {
        return res.status(403).json({ message: "Sem permissão" });
      }
    }
    await storage.deleteCompetitor(Number(req.params.id));
    res.status(204).send();
  });

  // === CLIENT DASHBOARD SUMMARY ===

  /** GET /api/dashboard/client-summary - Returns kanban column counts, recent cards, and status summaries for the client user's dashboard. Requires auth. */
  app.get("/api/dashboard/client-summary", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const clientId = user.role === "client" ? user.clientId : null;
      if (!clientId) return res.json({ columns: [], recentCards: [], totalCards: 0, pendingApproval: 0, approved: 0, revision: 0, rejected: 0, scheduled: 0, posted: 0, finished: 0, inProgress: 0 });

      const columns = await storage.getKanbanColumnsByClient(clientId);
      const cards = await storage.getKanbanCardsByClient(clientId);

      const columnMap = new Map(columns.map(c => [c.id, c.title]));
      const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

      const columnSummary = sortedColumns.map(col => {
        const colCards = cards.filter(c => c.columnId === col.id);
        return {
          id: col.id,
          title: col.title,
          count: colCards.length,
        };
      });

      const recentCards = [...cards]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
        .slice(0, 10)
        .map(card => ({
          id: card.id,
          title: card.title,
          cardType: card.cardType,
          columnTitle: columnMap.get(card.columnId) || "",
          updatedAt: card.updatedAt || card.createdAt,
        }));

      const pendingApproval = cards.filter(c => columnMap.get(c.columnId) === "Em Aprovação").length;
      const approved = cards.filter(c => columnMap.get(c.columnId) === "Aprovados").length;
      const revision = cards.filter(c => columnMap.get(c.columnId) === "Revisão").length;
      const rejected = cards.filter(c => columnMap.get(c.columnId) === "Reprovados").length;
      const scheduled = cards.filter(c => {
        const t = columnMap.get(c.columnId);
        return t === "Agendados" || t === "Agendamento";
      }).length;
      const posted = cards.filter(c => columnMap.get(c.columnId) === "Postados").length;
      const finished = cards.filter(c => columnMap.get(c.columnId) === "Finalizados").length;
      const inProgress = cards.filter(c => {
        const t = columnMap.get(c.columnId);
        return t === "Fila" || t === "Desenvolvendo Design" || t === "Desenvolvendo Copy";
      }).length;

      res.json({
        columns: columnSummary,
        recentCards,
        totalCards: cards.length,
        pendingApproval,
        approved,
        revision,
        rejected,
        scheduled,
        posted,
        finished,
        inProgress,
      });
    } catch (err) {
      console.error("Error getting client dashboard summary:", err);
      res.status(500).json({ message: "Erro ao buscar resumo do dashboard" });
    }
  });

  // === DASHBOARD INSIGHTS ===

  /** GET /api/insights/overview - Returns approval rate, monthly data, platform breakdown, and status breakdown for the insights dashboard. Requires auth. */
  app.get("/api/insights/overview", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });

    const allPosts = await storage.getPosts();
    const allApprovals = await storage.getApprovalPosts();

    let filteredPosts = allPosts;
    let filteredApprovals = allApprovals;

    if (user.role === "client" && user.clientId) {
      filteredPosts = allPosts.filter(p => p.clientId === user.clientId);
      filteredApprovals = allApprovals.filter(a => a.clientId === user.clientId);
    }

    const totalApprovals = filteredApprovals.length;
    const approvedCount = filteredApprovals.filter(a => a.status === "Aprovado").length;
    const approvalRate = totalApprovals > 0 ? Math.round((approvedCount / totalApprovals) * 100) : 0;

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyData: { month: string; posts: number; approvals: number }[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

      const postsInMonth = filteredPosts.filter(p => {
        const pd = new Date(p.scheduledDate);
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
      }).length;

      const approvalsInMonth = filteredApprovals.filter(a => {
        const ad = new Date(a.createdAt || 0);
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
      }).length;

      monthlyData.push({ month: monthLabel, posts: postsInMonth, approvals: approvalsInMonth });
    }

    const platformBreakdown: Record<string, number> = {};
    filteredApprovals.forEach(a => {
      if (a.platform && Array.isArray(a.platform)) {
        a.platform.forEach(p => {
          platformBreakdown[p] = (platformBreakdown[p] || 0) + 1;
        });
      }
    });

    const statusBreakdown: Record<string, number> = {};
    filteredApprovals.forEach(a => {
      statusBreakdown[a.status] = (statusBreakdown[a.status] || 0) + 1;
    });

    res.json({
      approvalRate,
      totalPosts: filteredPosts.length,
      totalApprovals,
      approvedCount,
      monthlyData,
      platformBreakdown,
      statusBreakdown,
    });
  });

  // === BRIEFING ROUTES ===

  /** GET /api/briefings - Lists briefings. Client users see only their client's briefings. Requires auth. */
  app.get("/api/briefings", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });

    let result;
    if (user.role === "client" && user.clientId) {
      result = await storage.getBriefingsByClient(user.clientId);
    } else {
      result = await storage.getBriefings();
    }
    res.json(result);
  });

  /** GET /api/briefings/public/:token - Returns a briefing by its public token (no auth required). Includes client name. */
  app.get("/api/briefings/public/:token", async (req, res) => {
    const { token } = req.params;
    const briefing = await storage.getBriefingByToken(token);
    if (!briefing) return res.status(404).json({ message: "Briefing não encontrado" });
    const client = await storage.getClient(briefing.clientId);
    res.json({ ...briefing, client: client ? { name: client.name } : null });
  });

  /** GET /api/briefings/public/:token/template - Returns the custom template questions for a briefing by its public token. No auth required. */
  app.get("/api/briefings/public/:token/template", async (req, res) => {
    const { token } = req.params;
    const briefing = await storage.getBriefingByToken(token);
    if (!briefing) return res.status(404).json({ message: "Briefing não encontrado" });
    if (briefing.briefingType !== "custom" || !briefing.templateId) {
      return res.status(400).json({ message: "Este briefing não usa template personalizado" });
    }
    const template = await storage.getBriefingTemplate(briefing.templateId);
    if (!template) return res.status(404).json({ message: "Template não encontrado" });
    let questions: any[] = [];
    try { questions = JSON.parse(template.questions); } catch {}
    res.json({ name: template.name, description: template.description, questions });
  });

  /** PUT /api/briefings/public/:token - Submits answers for a briefing by its public token. Sets status to "Respondido". No auth required. */
  app.put("/api/briefings/public/:token", async (req, res) => {
    const { token } = req.params;
    const briefing = await storage.getBriefingByToken(token);
    if (!briefing) return res.status(404).json({ message: "Briefing não encontrado" });
    if (briefing.status === "Respondido") {
      return res.status(400).json({ message: "Este briefing já foi respondido" });
    }
    try {
      const updated = await storage.updateBriefing(briefing.id, {
        answers: JSON.stringify(req.body.answers),
        status: "Respondido",
      });
      res.json(updated);
    } catch (err) {
      console.error("Error submitting briefing:", err);
      res.status(500).json({ message: "Erro ao enviar briefing" });
    }
  });

  /** GET /api/linkpage/:slug - Returns public link page data for a client by slug. Filters fields based on visibility settings. No auth required. */
  app.get("/api/linkpage/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const client = await storage.getClientBySlug(slug);
      if (!client || client.isActive === false) {
        return res.status(404).json({ message: "Página não encontrada" });
      }
      const products = await storage.getClientProducts(client.id);
      const services = await storage.getClientServices(client.id);
      const customLinks = await storage.getClientCustomLinks(client.id);

      let visibility: Record<string, boolean> = {};
      try {
        visibility = client.linkPageVisibility ? JSON.parse(client.linkPageVisibility) : {};
      } catch {}

      const isVisible = (field: string) => visibility[field] !== false;

      res.json({
        name: client.name,
        bio: client.bio,
        about: client.about,
        logoUrl: client.logoUrl,
        phone: isVisible("phone") ? client.phone : null,
        whatsapp: isVisible("whatsapp") ? client.whatsapp : null,
        email: isVisible("email") ? client.email : null,
        website: isVisible("website") ? client.website : null,
        instagram: isVisible("instagram") ? client.instagram : null,
        facebook: isVisible("facebook") ? client.facebook : null,
        tiktok: isVisible("tiktok") ? client.tiktok : null,
        linkedin: isVisible("linkedin") ? client.linkedin : null,
        youtube: isVisible("youtube") ? client.youtube : null,
        primaryColor: client.primaryColor || "#84cc16",
        secondaryColor: client.secondaryColor || "#1a1a2e",
        products: isVisible("products") ? products.map(p => ({ name: p.name, description: p.description })) : [],
        services: isVisible("services") ? services.map(s => ({ name: s.name, description: s.description })) : [],
        customLinks: customLinks.map(l => ({ name: l.name, url: l.url, icon: l.icon })),
        visibility,
        defaultTheme: client.linkPageTheme || "auto",
      });
    } catch (err) {
      console.error("Error fetching linkpage:", err);
      res.status(500).json({ message: "Erro ao carregar página" });
    }
  });

  /** PUT /api/onboarding/:clientId/linkpage - Updates link page settings (bio, social links, colors, slug, visibility, theme) for a client. Requires auth + onboarding access. */
  app.put("/api/onboarding/:clientId/linkpage", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const { bio, whatsapp, website, facebook, tiktok, linkedin, youtube, primaryColor, secondaryColor, slug, linkPageVisibility, linkPageTheme } = req.body;
    const updates: Record<string, any> = {};
    if (bio !== undefined) updates.bio = bio || null;
    if (whatsapp !== undefined) updates.whatsapp = whatsapp || null;
    if (website !== undefined) updates.website = website || null;
    if (facebook !== undefined) updates.facebook = facebook || null;
    if (tiktok !== undefined) updates.tiktok = tiktok || null;
    if (linkedin !== undefined) updates.linkedin = linkedin || null;
    if (youtube !== undefined) updates.youtube = youtube || null;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor || null;
    if (secondaryColor !== undefined) updates.secondaryColor = secondaryColor || null;
    if (slug !== undefined) updates.slug = slug || null;
    if (linkPageVisibility !== undefined) updates.linkPageVisibility = linkPageVisibility;
    if (linkPageTheme !== undefined) updates.linkPageTheme = linkPageTheme;
    try {
      const updated = await storage.updateClient(clientId, updates);
      res.json(updated);
    } catch (err: any) {
      if (err?.message?.includes("unique") || err?.code === "23505") {
        return res.status(400).json({ message: "Este slug já está em uso. Escolha outro." });
      }
      throw err;
    }
  });

  /** GET /api/onboarding/:clientId/custom-links - Returns custom links for a client's link page. Requires auth + onboarding access. */
  app.get("/api/onboarding/:clientId/custom-links", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const links = await storage.getClientCustomLinks(clientId);
    res.json(links);
  });

  /** POST /api/onboarding/:clientId/custom-links - Creates a new custom link for a client's link page. Requires auth + onboarding access. */
  app.post("/api/onboarding/:clientId/custom-links", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const { name, url, icon, position } = req.body;
    if (!name || !url) return res.status(400).json({ message: "Nome e URL são obrigatórios" });
    const link = await storage.createClientCustomLink({ clientId, name: String(name), url: String(url), icon: String(icon || "link"), position: Number(position) || 0 });
    res.status(201).json(link);
  });

  /** PUT /api/custom-links/:id - Updates a custom link by ID. Requires auth + internal role. */
  app.put("/api/custom-links/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    const id = Number(req.params.id);
    const { name, url, icon, position } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = String(name);
    if (url !== undefined) updates.url = String(url);
    if (icon !== undefined) updates.icon = String(icon);
    if (position !== undefined) updates.position = Number(position);
    const updated = await storage.updateClientCustomLink(id, updates);
    res.json(updated);
  });

  /** DELETE /api/custom-links/:id - Deletes a custom link. Internal roles can delete any; client users can only delete their own. Requires auth. */
  app.delete("/api/custom-links/:id", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    if (isInternalRole(user.role)) {
      await storage.deleteClientCustomLink(Number(req.params.id));
      return res.json({ success: true });
    }
    if (user.role === "client" && user.clientId) {
      const link = await storage.getClientCustomLink(Number(req.params.id));
      if (link && link.clientId === user.clientId) {
        await storage.deleteClientCustomLink(Number(req.params.id));
        return res.json({ success: true });
      }
    }
    return res.status(403).json({ message: "Acesso negado" });
  });

  /** Directory path for storing briefing file uploads */
  const BRIEFING_UPLOADS_DIR = path.join(process.cwd(), "uploads", "briefings");
  if (!fs.existsSync(BRIEFING_UPLOADS_DIR)) fs.mkdirSync(BRIEFING_UPLOADS_DIR, { recursive: true });

  /** POST /api/uploads/briefing - Uploads an image file for a briefing. Requires briefing token header. Max 2MB, images only. No auth required. */
  app.post("/api/uploads/briefing", upload.single("file"), async (req, res) => {
    try {
      const token = (req.headers["x-briefing-token"] || req.headers["X-Briefing-Token"]) as string;
      if (!token) return res.status(401).json({ message: "Token do briefing é obrigatório" });

      const briefing = await storage.getBriefingByToken(token);
      if (!briefing) return res.status(404).json({ message: "Briefing não encontrado" });
      if (briefing.status === "Respondido") return res.status(400).json({ message: "Briefing já respondido" });

      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ message: "Apenas imagens são permitidas" });
      }

      if (file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ message: "Arquivo excede o limite de 2MB" });
      }

      const ext = path.extname(file.originalname) || ".jpg";
      const filename = `${randomUUID()}${ext}`;
      const filePath = path.join(BRIEFING_UPLOADS_DIR, filename);
      fs.writeFileSync(filePath, file.buffer);

      const objectPath = `/api/uploads/briefing/${filename}`;
      res.json({ objectPath });
    } catch (err) {
      console.error("Briefing upload error:", err);
      res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });

  /** GET /api/uploads/briefing/:filename - Serves a previously uploaded briefing file. No auth required. */
  app.get("/api/uploads/briefing/:filename", (req, res) => {
    const filename = req.params.filename;
    const safeName = path.basename(filename);
    const filePath = path.join(BRIEFING_UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Arquivo não encontrado" });
    res.sendFile(filePath);
  });

  /** Directory path for storing client logo uploads */
  const LOGOS_DIR = path.join(process.cwd(), "uploads", "logos");
  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

  /** POST /api/uploads/logo - Uploads and optimizes a client logo image (max 400x400, PNG). Max 5MB. Requires auth. */
  app.post("/api/uploads/logo", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ message: "Apenas imagens são permitidas" });
      }

      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Arquivo excede o limite de 5MB" });
      }

      const ext = path.extname(file.originalname) || ".png";
      const filename = `${randomUUID()}${ext}`;

      const optimized = await sharp(file.buffer)
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .png({ quality: 85 })
        .toBuffer();

      const filePath = path.join(LOGOS_DIR, filename);
      fs.writeFileSync(filePath, optimized);

      const objectPath = `/api/uploads/logo/${filename}`;
      res.json({ objectPath });
    } catch (err) {
      console.error("Logo upload error:", err);
      res.status(500).json({ message: "Erro ao fazer upload da logo" });
    }
  });

  /** GET /api/uploads/logo/:filename - Serves a previously uploaded logo file with 24h cache. No auth required. */
  app.get("/api/uploads/logo/:filename", (req, res) => {
    const filename = req.params.filename;
    const safeName = path.basename(filename);
    const filePath = path.join(LOGOS_DIR, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Logo não encontrada" });
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  });

  /** GET /api/briefings/:id - Returns a single briefing by ID. Client users can only access their own client's briefings. Requires auth. */
  app.get("/api/briefings/:id", requireAuth, async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
    const briefing = await storage.getBriefing(id);
    if (!briefing) return res.status(404).json({ message: "Briefing não encontrado" });
    const user = await getCurrentUser(req);
    if (user?.role === "client" && user.clientId !== briefing.clientId) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    res.json(briefing);
  });

  /** POST /api/briefings - Creates a new briefing with a unique public token. Requires internal role. */
  app.post("/api/briefings", requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const { clientId, clientName, title, briefingType, templateId } = req.body;
      const user = await getCurrentUser(req);
      const token = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
      const briefing = await storage.createBriefing({
        clientId,
        clientName,
        title: title || (briefingType === "custom" ? "Briefing Personalizado" : "Briefing de Marca"),
        briefingType: briefingType || "brand",
        templateId: templateId || null,
        status: "Pendente",
        token,
        answers: null,
        createdBy: user?.id || null,
      });
      res.status(201).json(briefing);
    } catch (err) {
      console.error("Error creating briefing:", err);
      res.status(500).json({ message: "Erro ao criar briefing" });
    }
  });

  /** PUT /api/briefings/:id - Updates a briefing by ID. Requires internal role. */
  app.put("/api/briefings/:id", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
    try {
      const briefing = await storage.updateBriefing(id, req.body);
      res.json(briefing);
    } catch (err) {
      console.error("Error updating briefing:", err);
      res.status(500).json({ message: "Erro ao atualizar briefing" });
    }
  });

  /** DELETE /api/briefings/:id - Deletes a briefing by ID. Requires internal role. */
  app.delete("/api/briefings/:id", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
    await storage.deleteBriefing(id);
    res.json({ success: true });
  });

  /** GET /api/briefing-templates - Lists all briefing templates. Requires auth. */
  app.get("/api/briefing-templates", requireAuth, async (_req, res) => {
    const templates = await storage.getBriefingTemplates();
    res.json(templates);
  });

  /** GET /api/briefing-templates/:id - Returns a single briefing template by ID. Requires auth. */
  app.get("/api/briefing-templates/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const template = await storage.getBriefingTemplate(id);
    if (!template) return res.status(404).json({ message: "Template não encontrado" });
    res.json(template);
  });

  /** POST /api/briefing-templates - Creates a new briefing template. Requires internal role. */
  app.post("/api/briefing-templates", requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      const template = await storage.createBriefingTemplate({
        name: req.body.name,
        description: req.body.description || null,
        questions: req.body.questions,
        createdBy: user?.id || null,
      });
      res.status(201).json(template);
    } catch (err) {
      console.error("Error creating briefing template:", err);
      res.status(500).json({ message: "Erro ao criar template" });
    }
  });

  /** PUT /api/briefing-templates/:id - Updates a briefing template by ID. Requires internal role. */
  app.put("/api/briefing-templates/:id", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const id = Number(req.params.id);
    try {
      const template = await storage.updateBriefingTemplate(id, req.body);
      res.json(template);
    } catch (err) {
      console.error("Error updating briefing template:", err);
      res.status(500).json({ message: "Erro ao atualizar template" });
    }
  });

  /** DELETE /api/briefing-templates/:id - Deletes a briefing template by ID. Requires internal role. */
  app.delete("/api/briefing-templates/:id", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteBriefingTemplate(id);
    res.json({ success: true });
  });

  /** POST /api/uploads/briefing-file - Uploads a file for a briefing (any type, max 10MB). Attempts Google Drive upload first, falls back to local storage. Requires briefing token header. */
  app.post("/api/uploads/briefing-file", upload.single("file"), async (req, res) => {
    try {
      const token = (req.headers["x-briefing-token"] || req.headers["X-Briefing-Token"]) as string;
      if (!token) return res.status(401).json({ message: "Token do briefing é obrigatório" });

      const briefing = await storage.getBriefingByToken(token);
      if (!briefing) return res.status(404).json({ message: "Briefing não encontrado" });
      if (briefing.status === "Respondido") return res.status(400).json({ message: "Briefing já respondido" });

      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "Arquivo excede o limite de 10MB" });
      }

      const client = await storage.getClient(briefing.clientId);
      if (client?.driveFolderId) {
        try {
          const driveConnected = await isDriveConnected();
          if (driveConnected) {
            const result = await uploadKanbanFileToDrive(
              client.driveFolderId,
              file.originalname,
              file.buffer,
              file.mimetype
            );
            return res.json({
              fileName: file.originalname,
              fileUrl: result.fileUrl,
              driveFileId: result.fileId,
              size: file.size,
            });
          }
        } catch (driveErr) {
          console.error("Drive upload for briefing failed, using local:", driveErr);
        }
      }

      const ext = path.extname(file.originalname) || "";
      const filename = `${randomUUID()}${ext}`;
      const filePath = path.join(BRIEFING_UPLOADS_DIR, filename);
      fs.writeFileSync(filePath, file.buffer);

      res.json({
        fileName: file.originalname,
        fileUrl: `/api/uploads/briefing/${filename}`,
        size: file.size,
      });
    } catch (err) {
      console.error("Briefing file upload error:", err);
      res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });

  // === SYSTEM SETTINGS ROUTES ===

  /** GET /api/settings/drive - Returns masked Google Drive credentials status. Requires admin role. */
  app.get("/api/settings/drive", requireAuth, requireRole("admin"), async (_req, res) => {
    try {
      const settings = await storage.getSystemSettings([
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REFRESH_TOKEN",
      ]);
      res.json({
        googleClientId: settings.GOOGLE_CLIENT_ID ? "••••" + settings.GOOGLE_CLIENT_ID.slice(-6) : "",
        googleClientSecret: settings.GOOGLE_CLIENT_SECRET ? "••••" + settings.GOOGLE_CLIENT_SECRET.slice(-6) : "",
        googleRefreshToken: settings.GOOGLE_REFRESH_TOKEN ? "••••" + settings.GOOGLE_REFRESH_TOKEN.slice(-6) : "",
        hasCredentials: !!(settings.GOOGLE_CLIENT_ID && settings.GOOGLE_CLIENT_SECRET && settings.GOOGLE_REFRESH_TOKEN),
      });
    } catch (err) {
      console.error("Error getting drive settings:", err);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  /** POST /api/settings/drive - Saves and validates Google Drive OAuth credentials. Tests connection before saving. Requires admin role. */
  app.post("/api/settings/drive", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { googleClientId, googleClientSecret, googleRefreshToken } = req.body;
      if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
        return res.status(400).json({ message: "Todas as credenciais são obrigatórias" });
      }

      const { google } = await import("googleapis");
      const testClient = new google.auth.OAuth2(googleClientId, googleClientSecret);
      testClient.setCredentials({ refresh_token: googleRefreshToken });
      const testDrive = google.drive({ version: "v3", auth: testClient });
      try {
        await testDrive.about.get({ fields: "user" });
      } catch {
        return res.status(400).json({ message: "Credenciais inválidas. Verifique os dados e tente novamente." });
      }

      await storage.setSystemSetting("GOOGLE_CLIENT_ID", googleClientId);
      await storage.setSystemSetting("GOOGLE_CLIENT_SECRET", googleClientSecret);
      await storage.setSystemSetting("GOOGLE_REFRESH_TOKEN", googleRefreshToken);
      resetOAuth2Client();

      const userInfo = await getDriveUserInfo();
      res.json({ success: true, connected: true, user: userInfo });
    } catch (err: any) {
      console.error("Error saving drive settings:", err);
      res.status(500).json({ message: err.message || "Erro ao salvar configurações" });
    }
  });

  /** DELETE /api/settings/drive - Removes all Google Drive credentials and resets the OAuth client. Requires admin role. */
  app.delete("/api/settings/drive", requireAuth, requireRole("admin"), async (_req, res) => {
    try {
      await storage.setSystemSetting("GOOGLE_CLIENT_ID", "");
      await storage.setSystemSetting("GOOGLE_CLIENT_SECRET", "");
      await storage.setSystemSetting("GOOGLE_REFRESH_TOKEN", "");
      resetOAuth2Client();
      res.json({ success: true });
    } catch (err) {
      console.error("Error removing drive settings:", err);
      res.status(500).json({ message: "Erro ao remover configurações" });
    }
  });

  // === SYSTEM BRANDING SETTINGS ===

  /** Directory path for storing system branding uploads (logo, favicon) */
  const SYSTEM_UPLOADS_DIR = path.join(process.cwd(), "uploads", "system");
  if (!fs.existsSync(SYSTEM_UPLOADS_DIR)) fs.mkdirSync(SYSTEM_UPLOADS_DIR, { recursive: true });

  /** GET /api/settings/branding - Returns system branding settings (name, logo, favicon, theme). No auth required. */
  app.get("/api/settings/branding", async (_req, res) => {
    try {
      const settings = await storage.getSystemSettings([
        "SYSTEM_NAME", "SYSTEM_LOGO", "SYSTEM_FAVICON", "SYSTEM_THEME",
      ]);
      res.json({
        systemName: settings.SYSTEM_NAME || "Shift",
        systemLogo: settings.SYSTEM_LOGO || "",
        systemFavicon: settings.SYSTEM_FAVICON || "",
        systemTheme: settings.SYSTEM_THEME || "classic",
      });
    } catch (err) {
      console.error("Error getting branding settings:", err);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  /** PUT /api/settings/branding - Updates system branding settings (name, theme). Validates theme against allowed values. Requires admin role. */
  app.put("/api/settings/branding", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { systemName, systemTheme } = req.body;
      if (systemName !== undefined) await storage.setSystemSetting("SYSTEM_NAME", systemName);
      if (systemTheme !== undefined) {
        const validThemes = ["classic", "business", "creative"];
        if (!validThemes.includes(systemTheme)) {
          return res.status(400).json({ message: "Tema inválido" });
        }
        await storage.setSystemSetting("SYSTEM_THEME", systemTheme);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Error saving branding settings:", err);
      res.status(500).json({ message: "Erro ao salvar configurações" });
    }
  });

  /** POST /api/uploads/system/:type - Uploads a system logo or favicon image. Resizes and converts to PNG. Requires admin role. */
  app.post("/api/uploads/system/:type", requireAuth, requireRole("admin"), upload.single("file"), async (req, res) => {
    try {
      const uploadType = req.params.type;
      if (!["logo", "favicon"].includes(uploadType)) {
        return res.status(400).json({ message: "Tipo inválido" });
      }
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado" });
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ message: "Apenas imagens são permitidas" });
      }
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Arquivo excede o limite de 5MB" });
      }

      const rawExt = path.extname(file.originalname).toLowerCase();
      const allowedExts = [".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp", ".gif"];
      const ext = allowedExts.includes(rawExt) ? rawExt : ".png";
      const filename = `${uploadType}_${Date.now()}${ext}`;

      let processedBuffer: Buffer;
      if (uploadType === "favicon") {
        processedBuffer = await sharp(file.buffer)
          .resize(64, 64, { fit: "cover" })
          .png()
          .toBuffer();
      } else {
        processedBuffer = await sharp(file.buffer)
          .resize(400, 400, { fit: "inside", withoutEnlargement: true })
          .png({ quality: 90 })
          .toBuffer();
      }

      const filePath = path.join(SYSTEM_UPLOADS_DIR, filename);
      fs.writeFileSync(filePath, processedBuffer);

      const objectPath = `/api/uploads/system/${filename}`;
      const settingKey = uploadType === "logo" ? "SYSTEM_LOGO" : "SYSTEM_FAVICON";
      await storage.setSystemSetting(settingKey, objectPath);

      res.json({ objectPath });
    } catch (err) {
      console.error("System upload error:", err);
      res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });

  /** GET /api/uploads/system/:filename - Serves a previously uploaded system file (logo/favicon) with 24h cache. No auth required. */
  app.get("/api/uploads/system/:filename", (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(SYSTEM_UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Arquivo não encontrado" });
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  });

  // === GOOGLE DRIVE ROUTES ===

  /** GET /api/drive/status - Returns Google Drive connection status and user info. Requires admin role. */
  app.get("/api/drive/status", requireRole("admin"), async (_req, res) => {
    try {
      const connected = await isDriveConnected();
      if (!connected) {
        return res.json({ connected: false });
      }
      const userInfo = await getDriveUserInfo();
      res.json({ connected: true, user: userInfo });
    } catch {
      res.json({ connected: false });
    }
  });

  /** POST /api/drive/sync-client/:id - Creates a Google Drive folder for a specific client and updates the client record. Requires admin role. */
  app.post("/api/drive/sync-client/:id", requireRole("admin"), async (req, res) => {
    const id = Number(req.params.id);
    const client = await storage.getClient(id);
    if (!client) return res.status(404).json({ message: "Cliente não encontrado" });

    try {
      const driveResult = await createClientFolder(client.name, client.id);
      const updated = await storage.updateClient(id, {
        driveFolderId: driveResult.folderId,
        driveFolderUrl: driveResult.folderUrl,
      });
      res.json(updated);
    } catch (err) {
      console.error("Drive sync failed:", err);
      res.status(500).json({ message: "Falha ao sincronizar com Google Drive" });
    }
  });

  /** POST /api/drive/sync-all - Creates Google Drive folders for all clients that don't have one yet. Requires admin role. */
  app.post("/api/drive/sync-all", requireRole("admin"), async (_req, res) => {
    const allClients = await storage.getClients();
    const results: { clientId: number; name: string; success: boolean; error?: string }[] = [];

    for (const client of allClients) {
      if (client.driveFolderId) {
        results.push({ clientId: client.id, name: client.name, success: true });
        continue;
      }
      try {
        const driveResult = await createClientFolder(client.name, client.id);
        await storage.updateClient(client.id, {
          driveFolderId: driveResult.folderId,
          driveFolderUrl: driveResult.folderUrl,
        });
        results.push({ clientId: client.id, name: client.name, success: true });
      } catch (err: any) {
        results.push({ clientId: client.id, name: client.name, success: false, error: err.message });
      }
    }

    res.json({ results });
  });

  /**
   * GET /api/approvals/:id/drive-files
   * Retrieves Google Drive files associated with an approval post.
   * Returns cached driveFileIds if available, otherwise lists files from the Drive folder.
   * Requires authentication.
   */
  app.get("/api/approvals/:id/drive-files", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const approval = await storage.getApprovalPost(id);
      if (!approval) return res.status(404).json({ message: "Aprovação não encontrada" });

      if (approval.driveFileIds) {
        try {
          const files = JSON.parse(approval.driveFileIds);
          return res.json({
            folderId: approval.driveFolderId,
            folderUrl: approval.driveFolderUrl,
            files,
          });
        } catch { }
      }

      if (approval.driveFolderId) {
        const files = await listDriveFiles(approval.driveFolderId);
        return res.json({
          folderId: approval.driveFolderId,
          folderUrl: approval.driveFolderUrl,
          files,
        });
      }

      res.json({ files: [] });
    } catch (err: any) {
      console.error("Error fetching Drive files:", err);
      res.status(500).json({ message: "Erro ao buscar arquivos do Drive" });
    }
  });

  /**
   * GET /api/approvals/:id/drive-history
   * Retrieves the version history of Drive files for an approval post.
   * Lists version folders and their contained files from the client's Drive folder.
   * Requires authentication.
   */
  app.get("/api/approvals/:id/drive-history", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const approval = await storage.getApprovalPost(id);
      if (!approval) return res.status(404).json({ message: "Aprovação não encontrada" });

      if (!approval.clientId) return res.json({ versions: [] });

      const client = await storage.getClient(approval.clientId);
      if (!client?.driveFolderId) return res.json({ versions: [] });

      const versionFolders = await listApprovalVersionFolders(client.driveFolderId, approval.title);

      const versions = [];
      for (const folder of versionFolders) {
        const files = await listDriveFiles(folder.folderId);
        versions.push({
          version: folder.name,
          folderId: folder.folderId,
          folderUrl: folder.folderUrl,
          files,
        });
      }

      res.json({ versions });
    } catch (err: any) {
      console.error("Error fetching Drive history:", err);
      res.status(500).json({ message: "Erro ao buscar histórico do Drive" });
    }
  });

  app.get("/api/drive/file/:fileId/download", requireAuth, async (req, res) => {
    try {
      const { fileId } = req.params;
      const downloadUrl = await getDriveFileDownloadUrl(String(fileId));
      res.json({ downloadUrl });
    } catch (err: any) {
      console.error("Error getting download URL:", err);
      res.status(500).json({ message: "Erro ao obter URL de download" });
    }
  });

  // === KANBAN ROUTES ===

  /**
   * GET /api/kanban/:clientId/columns
   * Lists all Kanban columns for a given client. Auto-creates default columns if none exist,
   * adds missing required columns, handles conditional columns (Reunião/Captação),
   * and reorders columns to match expected positions.
   * Requires authentication. Clients can only access their own columns.
   */
  app.get("/api/kanban/:clientId/columns", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = await getCurrentUser(req);
    if (user?.role === "client" && user.clientId !== clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const client = await storage.getClient(clientId);
    const conditionalEnabled: string[] = [];
    if (client?.enableReuniao) conditionalEnabled.push("Reunião");
    if (client?.enableCaptacao) conditionalEnabled.push("Captação");

    const allExpectedCols = [...DEFAULT_KANBAN_COLUMNS];
    for (let i = conditionalEnabled.length - 1; i >= 0; i--) {
      allExpectedCols.splice(CONDITIONAL_COLUMN_POSITION, 0, conditionalEnabled[i]);
    }

    let columns = await storage.getKanbanColumnsByClient(clientId);
    if (columns.length === 0) {
      for (let i = 0; i < allExpectedCols.length; i++) {
        await storage.createKanbanColumn({
          clientId,
          title: allExpectedCols[i],
          position: i,
          isDefault: true,
        });
      }
      columns = await storage.getKanbanColumnsByClient(clientId);
    } else {
      const existingTitles = new Set(columns.map(c => c.title));
      const missingCols: string[] = [];
      for (const requiredCol of allExpectedCols) {
        if (!existingTitles.has(requiredCol)) {
          missingCols.push(requiredCol);
        }
      }
      if (missingCols.length > 0) {
        for (const title of missingCols) {
          await storage.createKanbanColumn({ clientId, title, position: 999, isDefault: true });
        }
        columns = await storage.getKanbanColumnsByClient(clientId);
      }

      const conditionalNames = Object.keys(CONDITIONAL_COLUMNS);
      const disabledConditional = conditionalNames.filter(n => !conditionalEnabled.includes(n));

      const visibleCols = columns.filter(c => !disabledConditional.includes(c.title));

      const expectedCols: typeof columns = [];
      const otherCols: typeof columns = [];
      for (const col of visibleCols) {
        if (allExpectedCols.includes(col.title)) {
          expectedCols.push(col);
        } else {
          otherCols.push(col);
        }
      }
      expectedCols.sort((a, b) => allExpectedCols.indexOf(a.title) - allExpectedCols.indexOf(b.title));
      otherCols.sort((a, b) => a.position - b.position);
      const sorted = [...expectedCols, ...otherCols];
      let needsRefresh = false;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].position !== i) {
          await storage.updateKanbanColumn(sorted[i].id, { position: i });
          needsRefresh = true;
        }
      }
      if (needsRefresh) {
        columns = await storage.getKanbanColumnsByClient(clientId);
      }
      columns = columns.filter(c => !disabledConditional.includes(c.title));
    }
    res.json(columns);
  });

  /**
   * POST /api/kanban/:clientId/columns
   * Creates a new Kanban column for a client.
   * Requires internal role (admin/designer).
   */
  app.post("/api/kanban/:clientId/columns", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const clientId = Number(req.params.clientId);
    const { title, position } = req.body;
    const col = await storage.createKanbanColumn({ clientId, title, position: position ?? 999 });
    res.json(col);
  });

  /**
   * PUT /api/kanban/columns/:id
   * Updates a Kanban column. Protected columns cannot be renamed.
   * Requires internal role (admin/designer).
   */
  app.put("/api/kanban/columns/:id", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const colId = Number(req.params.id);
    const existingCol = await storage.getKanbanColumn(colId);
    if (existingCol && PROTECTED_KANBAN_COLUMNS.includes(existingCol.title) && req.body.title && req.body.title !== existingCol.title) {
      return res.status(403).json({ message: `A coluna "${existingCol.title}" não pode ser renomeada` });
    }
    const col = await storage.updateKanbanColumn(colId, req.body);
    res.json(col);
  });

  /**
   * DELETE /api/kanban/columns/:id
   * Deletes a Kanban column. Protected/mandatory columns cannot be deleted.
   * Requires internal role (admin/designer).
   */
  app.delete("/api/kanban/columns/:id", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const colId = Number(req.params.id);
    const colToDelete = await storage.getKanbanColumn(colId);
    if (colToDelete && PROTECTED_KANBAN_COLUMNS.includes(colToDelete.title)) {
      return res.status(403).json({ message: `A coluna "${colToDelete.title}" é obrigatória e não pode ser excluída` });
    }
    await storage.deleteKanbanColumn(colId);
    res.json({ success: true });
  });

  /**
   * PUT /api/kanban/:clientId/columns/reorder
   * Reorders Kanban columns for a client by providing an array of column IDs.
   * Requires internal role (admin/designer).
   */
  app.put("/api/kanban/:clientId/columns/reorder", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const { columnIds } = req.body;
    await storage.reorderKanbanColumns(Number(req.params.clientId), columnIds);
    res.json({ success: true });
  });

  /**
   * GET /api/kanban/:clientId/cards
   * Lists all Kanban cards for a given client.
   * Requires authentication. Clients can only access their own cards.
   */
  app.get("/api/kanban/:clientId/cards", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = await getCurrentUser(req);
    if (user?.role === "client" && user.clientId !== clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const cards = await storage.getKanbanCardsByClient(clientId);
    res.json(cards);
  });

  /**
   * GET /api/client/approval-cards
   * Lists Kanban cards that have an approval status (Pendente, Aprovado, Reprovado, Revisão).
   * Clients see only their own cards; internal roles can filter by clientId or see all.
   * Requires authentication.
   */
  app.get("/api/client/approval-cards", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });

    let allCards: any[] = [];

    if (user.role === "client") {
      const clientId = user.clientId;
      if (!clientId) return res.status(400).json({ message: "Cliente não identificado" });
      allCards = await storage.getKanbanCardsByClient(clientId);
    } else if (isInternalRole(user.role)) {
      if (req.query.clientId) {
        allCards = await storage.getKanbanCardsByClient(Number(req.query.clientId));
      } else {
        const clients = await storage.getClients();
        for (const client of clients) {
          const cards = await storage.getKanbanCardsByClient(client.id);
          allCards.push(...cards);
        }
      }
    } else {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const approvalCards = allCards.filter(c =>
      c.approvalStatus && ["Pendente", "Aprovado", "Reprovado", "Revisão"].includes(c.approvalStatus)
    );
    res.json(approvalCards);
  });

  /**
   * GET /api/kanban/cards/:id
   * Retrieves a single Kanban card by ID.
   * Requires authentication.
   */
  app.get("/api/kanban/cards/:id", requireAuth, async (req, res) => {
    const card = await storage.getKanbanCard(Number(req.params.id));
    if (!card) return res.status(404).json({ message: "Cartão não encontrado" });
    res.json(card);
  });

  /**
   * POST /api/kanban/cards
   * Creates a new Kanban card. Always placed in the mandatory first column ("Fila").
   * Starts a time entry if the column is timed. Creates notifications for relevant roles.
   * Requires authentication.
   */
  app.post("/api/kanban/cards", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: "Cliente é obrigatório" });
    }

    const columns = await storage.getKanbanColumnsByClient(clientId);
    let filaColumn = columns.find(c => c.title === MANDATORY_FIRST_COLUMN);

    if (!filaColumn) {
      const maxPos = columns.length > 0 ? Math.max(...columns.map(c => c.position)) + 1 : 0;
      filaColumn = await storage.createKanbanColumn({
        clientId,
        title: MANDATORY_FIRST_COLUMN,
        position: 0,
      });
      for (const col of columns) {
        await storage.updateKanbanColumn(col.id, { position: col.position + 1 });
      }
    }

    const targetColumnId = filaColumn.id;
    const colCards = await storage.getKanbanCardsByColumn(targetColumnId);
    const maxPos = colCards.length > 0 ? Math.max(...colCards.map(c => c.position)) + 1 : 0;

    const card = await storage.createKanbanCard({ 
      ...req.body, 
      columnId: targetColumnId,
      position: maxPos,
      createdBy: user?.id 
    });
    await storage.createKanbanActivity({
      cardId: card.id,
      userId: user?.id ?? null,
      action: "created",
      details: `Cartão "${card.title}" criado`,
    });

    if (!TIMER_EXCLUDED_COLUMNS.includes(MANDATORY_FIRST_COLUMN) && user) {
      await storage.startTimeEntry(card.id, user.id, targetColumnId);
    }

    await storage.createNotification({
      clientId: card.clientId,
      type: "card_created",
      message: `"${card.title}" criado por ${user?.name || "Usuário"}`,
      recipientRole: user?.role === "client" ? "admin" : "client",
    });
    if (user && isInternalRole(user.role)) {
      await storage.createNotification({
        clientId: card.clientId,
        type: "card_created",
        message: `"${card.title}" criado por ${user.name || "Usuário"}`,
        recipientRole: user.role === "admin" ? "designer" : "admin",
      });
    }

    res.json(card);
  });

  /**
   * PUT /api/kanban/cards/:id
   * Updates a Kanban card's fields (title, description, template data, etc.).
   * Requires authentication.
   */
  app.put("/api/kanban/cards/:id", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    const existingCard = await storage.getKanbanCard(Number(req.params.id));
    if (!existingCard) return res.status(404).json({ message: "Cartão não encontrado" });

    if (user?.role === "client" && user.clientId !== existingCard.clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const updates = { ...req.body };
    if (user?.role === "client") {
      delete updates.approvalStatus;
      delete updates.approvalNotes;
      delete updates.approvalSentAt;
      delete updates.approvalResolvedAt;
    }

    const card = await storage.updateKanbanCard(Number(req.params.id), updates);
    res.json(card);
  });

  /**
   * DELETE /api/kanban/cards/:id
   * Deletes a Kanban card.
   * Requires internal role (admin/designer).
   */
  app.delete("/api/kanban/cards/:id", requireRole(...INTERNAL_ROLES), async (req, res) => {
    await storage.deleteKanbanCard(Number(req.params.id));
    res.json({ success: true });
  });

  /**
   * PUT /api/kanban/cards/:id/move
   * Moves a Kanban card to a different column and/or position.
   * Enforces workflow restrictions (e.g., restricted columns for manual moves).
   * Manages time entries, activity logs, approval status, and notifications.
   * Requires authentication.
   */
  app.put("/api/kanban/cards/:id/move", requireAuth, async (req, res) => {
    const { toColumnId, newPosition } = req.body;
    const cardId = Number(req.params.id);
    const user = await getCurrentUser(req);

    const oldCard = await storage.getKanbanCard(cardId);
    if (!oldCard) return res.status(404).json({ message: "Cartão não encontrado" });

    if (user?.role === "client" && user.clientId !== oldCard.clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const oldColumnId = oldCard.columnId;

    if (toColumnId !== oldColumnId) {
      const columns = await storage.getKanbanColumnsByClient(oldCard.clientId);
      const fromCol = columns.find(c => c.id === oldColumnId);
      const toCol = columns.find(c => c.id === toColumnId);

      const allowedManualMoves: Record<string, string[]> = {
        "Aprovados": ["Agendamento", "Postados"],
        "Agendamento": ["Agendados", "Postados", "Finalizados"],
        "Agendados": ["Postados", "Finalizados"],
        "Postados": ["Finalizados"],
      };

      const restrictedFromColumns = ["Em Aprovação", "Aprovados", "Agendamento", "Agendados", "Postados"];
      const restrictedToColumns = ["Aprovados", "Reprovados", "Agendamento", "Agendados", "Postados", "Finalizados"];

      if (fromCol && restrictedFromColumns.includes(fromCol.title)) {
        const allowed = allowedManualMoves[fromCol.title] || [];
        if (allowed.length === 0) {
          return res.status(403).json({ message: `Cartão em "${fromCol.title}" não pode ser movido manualmente. Aguarde a ação do cliente.` });
        }
        if (!allowed.includes(toCol?.title || "")) {
          return res.status(403).json({ message: `Cartão na coluna "${fromCol.title}" só pode ser movido para: ${allowed.join(", ")}` });
        }
      }

      if (toCol && restrictedToColumns.includes(toCol.title)) {
        const fromAllowed = allowedManualMoves[fromCol?.title || ""] || [];
        if (!fromAllowed.includes(toCol.title)) {
          return res.status(403).json({ message: `Não é permitido mover diretamente para "${toCol.title}". Use o fluxo de aprovação.` });
        }
      }
    }

    let card = await storage.moveKanbanCard(cardId, toColumnId, newPosition);

    if (oldColumnId !== toColumnId) {
      const columns = await storage.getKanbanColumnsByClient(card.clientId);
      const fromCol = columns.find(c => c.id === oldColumnId);
      const toCol = columns.find(c => c.id === toColumnId);

      if (toCol?.title === "Em Aprovação") {
        card = await storage.updateKanbanCard(cardId, {
          approvalStatus: "Pendente",
          approvalNotes: null,
          approvalSentAt: new Date(),
        });
      }

      await storage.createKanbanActivity({
        cardId: card.id,
        userId: user?.id ?? null,
        action: "moved",
        fromColumnId: oldColumnId,
        toColumnId,
        details: `Movido de "${fromCol?.title}" para "${toCol?.title}"`,
      });

      if (fromCol && !TIMER_EXCLUDED_COLUMNS.includes(fromCol.title)) {
        const openEntry = await storage.getOpenTimeEntry(cardId);
        if (openEntry) {
          await storage.stopTimeEntry(openEntry.id);
        }
      }
      if (toCol && !TIMER_EXCLUDED_COLUMNS.includes(toCol.title) && user) {
        await storage.startTimeEntry(cardId, user.id, toColumnId);
      }

      const moveMsg = `"${card.title}" movido de "${fromCol?.title}" para "${toCol?.title}" por ${user?.name || "Usuário"}`;
      if (user && isInternalRole(user.role)) {
        await storage.createNotification({
          clientId: card.clientId,
          type: "card_moved",
          message: moveMsg,
          recipientRole: "client",
        });
      } else if (user?.role === "client") {
        await storage.createNotification({
          clientId: card.clientId,
          type: "card_moved",
          message: moveMsg,
          recipientRole: "admin",
        });
      }
    }

    res.json(card);
  });

  /**
   * PUT /api/kanban/cards/:id/back-to-fila
   * Moves a Kanban card back to the "Fila" (queue) column.
   * Stops current time entry and starts a new one in the queue column.
   * Requires internal role (admin/designer).
   */
  app.put("/api/kanban/cards/:id/back-to-fila", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const cardId = Number(req.params.id);
      const user = await getCurrentUser(req);
      const card = await storage.getKanbanCard(cardId);
      if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

      const columns = await storage.getKanbanColumnsByClient(card.clientId);
      const filaCol = columns.find(c => c.title === MANDATORY_FIRST_COLUMN);
      if (!filaCol) return res.status(404).json({ message: "Coluna 'Fila' não encontrada" });

      const fromCol = columns.find(c => c.id === card.columnId);
      const oldColumnId = card.columnId;

      const updated = await storage.moveKanbanCard(cardId, filaCol.id, 0);

      await storage.createKanbanActivity({
        cardId: updated.id,
        userId: user?.id ?? null,
        action: "moved",
        fromColumnId: oldColumnId,
        toColumnId: filaCol.id,
        details: `Retornado de "${fromCol?.title}" para "Fila"`,
      });

      const openEntry = await storage.getOpenTimeEntry(cardId);
      if (openEntry) await storage.stopTimeEntry(openEntry.id);

      if (user) {
        await storage.startTimeEntry(cardId, user.id, filaCol.id);
      }

      await storage.createNotification({
        clientId: card.clientId,
        type: "card_moved",
        message: `"${card.title}" retornado para Fila por ${user?.name || "Usuário"}`,
        recipientRole: "client",
      });

      res.json(updated);
    } catch (err) {
      console.error("Error moving card back to fila:", err);
      res.status(500).json({ message: "Erro ao mover cartão" });
    }
  });

  /**
   * Moves a Kanban card to a target column by title.
   * Creates the column if it doesn't exist. Logs activity, manages time entries.
   * @param card - The card object to move
   * @param targetColumnTitle - The title of the destination column
   * @param userId - Optional user ID performing the move
   * @returns The updated card object
   */
  async function moveCardToColumn(card: any, targetColumnTitle: string, userId?: number | null): Promise<any> {
    const columns = await storage.getKanbanColumnsByClient(card.clientId);
    let targetCol = columns.find(c => c.title === targetColumnTitle);
    if (!targetCol) {
      const maxPos = columns.length > 0 ? Math.max(...columns.map(c => c.position)) + 1 : 0;
      targetCol = await storage.createKanbanColumn({
        clientId: card.clientId,
        title: targetColumnTitle,
        position: maxPos,
      });
    }

    const cardsInTarget = await storage.getKanbanCardsByClient(card.clientId);
    const targetCards = cardsInTarget.filter(c => c.columnId === targetCol.id);
    const maxPos = targetCards.length > 0 ? Math.max(...targetCards.map(c => c.position)) + 1 : 0;

    const fromCol = columns.find(c => c.id === card.columnId);

    const columnChanged = card.columnId !== targetCol.id;
    const updated = await storage.updateKanbanCard(card.id, {
      columnId: targetCol.id,
      position: maxPos,
      ...(columnChanged ? { columnEnteredAt: new Date() } : {}),
    });

    await storage.createKanbanActivity({
      cardId: card.id,
      userId: userId ?? null,
      action: "moved",
      fromColumnId: card.columnId,
      toColumnId: targetCol.id,
      details: `Movido de "${fromCol?.title}" para "${targetCol.title}"`,
    });

    if (fromCol && !TIMER_EXCLUDED_COLUMNS.includes(fromCol.title)) {
      const openEntry = await storage.getOpenTimeEntry(card.id);
      if (openEntry) {
        await storage.stopTimeEntry(openEntry.id);
      }
    }
    if (targetCol && !TIMER_EXCLUDED_COLUMNS.includes(targetCol.title) && userId) {
      await storage.startTimeEntry(card.id, userId, targetCol.id);
    }

    return updated;
  }

  /**
   * POST /api/kanban/cards/:id/send-approval
   * Sends a Kanban card for client approval. Sets status to "Pendente" and moves to "Em Aprovação" column.
   * Creates notification for the client. Fails if card is already linked to an approval post.
   * Requires internal role (admin/designer).
   */
  app.post("/api/kanban/cards/:id/send-approval", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const cardId = Number(req.params.id);
    const card = await storage.getKanbanCard(cardId);
    if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

    if (card.approvalPostId) {
      return res.status(400).json({ message: "Este cartão já está vinculado a uma aprovação de post" });
    }

    const user = await getCurrentUser(req);
    const updated = await storage.updateKanbanCard(cardId, {
      approvalStatus: "Pendente",
      approvalNotes: null,
      approvalSentAt: new Date(),
      approvalResolvedAt: null,
    });

    const moved = await moveCardToColumn(updated, "Em Aprovação", user?.id);

    await storage.createKanbanActivity({
      cardId,
      userId: user?.id ?? null,
      action: "sent_approval",
      details: "Enviado para aprovação do cliente",
    });

    await storage.createNotification({
      clientId: card.clientId,
      kanbanCardId: card.id,
      type: "approval_sent",
      message: `"${card.title}" enviado para sua aprovação por ${user?.name || "Designer"}`,
      recipientRole: "client",
    });

    res.json(moved);
  });

  /**
   * POST /api/kanban/cards/:id/approve
   * Approves a Kanban card. Sets status to "Aprovado", moves to "Aprovados" column.
   * Auto-creates a scheduled post from the card's template data.
   * Only clients (for their own cards) and admins can approve.
   * Requires authentication.
   */
  app.post("/api/kanban/cards/:id/approve", requireAuth, async (req, res) => {
    const cardId = Number(req.params.id);
    const card = await storage.getKanbanCard(cardId);
    if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

    const user = await getCurrentUser(req);
    if (!user || (user.role !== "client" && user.role !== "admin")) {
      return res.status(403).json({ message: "Apenas clientes e administradores podem aprovar materiais" });
    }
    if (user.role === "client" && user.clientId !== card.clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    if (card.approvalStatus !== "Pendente") {
      return res.status(400).json({ message: "Este cartão não está pendente de aprovação" });
    }

    const { notes } = req.body || {};

    const updated = await storage.updateKanbanCard(cardId, {
      approvalStatus: "Aprovado",
      approvalNotes: notes || null,
      approvalResolvedAt: new Date(),
    });

    const moved = await moveCardToColumn(updated, "Aprovados", user?.id);

    await storage.createKanbanActivity({
      cardId,
      userId: user?.id ?? null,
      action: "approved",
      details: notes ? `Aprovado: ${notes}` : "Aprovado pelo cliente",
    });

    await storage.createNotification({
      clientId: card.clientId,
      type: "card_approved",
      message: `"${card.title}" foi aprovado por ${user?.name || "Cliente"}`,
      recipientRole: "admin",
    });
    await storage.createNotification({
      clientId: card.clientId,
      type: "card_approved",
      message: `"${card.title}" foi aprovado por ${user?.name || "Cliente"}`,
      recipientRole: "designer",
    });

    try {
      const client = await storage.getClient(card.clientId);
      const clientName = client?.name || "Cliente";

      let templateObj: Record<string, string> = {};
      try {
        if (card.templateData) templateObj = JSON.parse(card.templateData as string);
      } catch {}

      const parsedPlatform = parsePlatform(templateObj.platform);
      const platform = parsedPlatform.length > 0 ? parsedPlatform : ["Instagram"];

      let scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      scheduledDate.setHours(10, 0, 0, 0);
      if (templateObj.publishDate) {
        try {
          const parsed = new Date(templateObj.publishDate);
          if (!isNaN(parsed.getTime())) scheduledDate = parsed;
        } catch {}
      }

      const content = templateObj.caption || card.description || "";

      let mediaUrl: string | null = null;
      let mediaUrls: string[] | null = null;
      if (card.attachments) {
        try {
          const attachments = JSON.parse(card.attachments as string);
          if (Array.isArray(attachments) && attachments.length > 0) {
            mediaUrl = attachments[0].driveUrl || attachments[0].url || null;
            mediaUrls = attachments.map((a: any) => a.driveUrl || a.url).filter(Boolean);
          }
        } catch {}
      }

      const postTitle = templateObj.postTitle || templateObj.headline || card.title;
      const postNotes = [
        templateObj.hashtags ? `Hashtags: ${templateObj.hashtags}` : "",
        templateObj.references ? `Referências: ${templateObj.references}` : "",
        `Importado do Kanban - Card #${card.id}`,
      ].filter(Boolean).join("\n");

      await storage.createPost({
        clientId: card.clientId,
        clientName: clientName,
        title: postTitle,
        content: content,
        platform: platform,
        scheduledDate: scheduledDate,
        status: "Agendado",
        mediaUrl: mediaUrl,
        mediaUrls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : null,
        notes: postNotes,
      });
    } catch (err) {
      console.error("Error auto-creating post from approved card:", err);
    }

    res.json(moved);
  });

  /**
   * POST /api/kanban/cards/:id/reject
   * Rejects a Kanban card. Sets status to "Reprovado", moves to "Reprovados" column.
   * Creates notifications for admin and designer roles.
   * Only clients (for their own cards) and admins can reject.
   * Requires authentication.
   */
  app.post("/api/kanban/cards/:id/reject", requireAuth, async (req, res) => {
    const cardId = Number(req.params.id);
    const card = await storage.getKanbanCard(cardId);
    if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

    const user = await getCurrentUser(req);
    if (!user || (user.role !== "client" && user.role !== "admin")) {
      return res.status(403).json({ message: "Apenas clientes e administradores podem reprovar materiais" });
    }
    if (user.role === "client" && user.clientId !== card.clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    if (card.approvalStatus !== "Pendente") {
      return res.status(400).json({ message: "Este cartão não está pendente de aprovação" });
    }

    const { notes } = req.body || {};

    const updated = await storage.updateKanbanCard(cardId, {
      approvalStatus: "Reprovado",
      approvalNotes: notes || null,
      approvalResolvedAt: new Date(),
    });

    const moved = await moveCardToColumn(updated, "Reprovados", user?.id);

    await storage.createKanbanActivity({
      cardId,
      userId: user?.id ?? null,
      action: "rejected",
      details: notes ? `Reprovado: ${notes}` : "Reprovado pelo cliente",
    });

    await storage.createNotification({
      clientId: card.clientId,
      type: "card_rejected",
      message: `"${card.title}" foi reprovado por ${user?.name || "Cliente"}${notes ? `: ${notes}` : ""}`,
      recipientRole: "admin",
    });
    await storage.createNotification({
      clientId: card.clientId,
      type: "card_rejected",
      message: `"${card.title}" foi reprovado por ${user?.name || "Cliente"}${notes ? `: ${notes}` : ""}`,
      recipientRole: "designer",
    });

    res.json(moved);
  });

  /**
   * POST /api/kanban/cards/:id/revision
   * Requests revision on a Kanban card. Sets status to "Revisão", moves to "Revisão" column.
   * Creates notifications for admin and designer roles.
   * Only clients (for their own cards) and admins can request revision.
   * Requires authentication.
   */
  app.post("/api/kanban/cards/:id/revision", requireAuth, async (req, res) => {
    const cardId = Number(req.params.id);
    const card = await storage.getKanbanCard(cardId);
    if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

    const user = await getCurrentUser(req);
    if (!user || (user.role !== "client" && user.role !== "admin")) {
      return res.status(403).json({ message: "Apenas clientes e administradores podem solicitar revisão" });
    }
    if (user.role === "client" && user.clientId !== card.clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    if (card.approvalStatus !== "Pendente") {
      return res.status(400).json({ message: "Este cartão não está pendente de aprovação" });
    }

    const { notes } = req.body || {};

    const updated = await storage.updateKanbanCard(cardId, {
      approvalStatus: "Revisão",
      approvalNotes: notes || null,
      approvalResolvedAt: new Date(),
    });

    const moved = await moveCardToColumn(updated, "Revisão", user?.id);

    await storage.createKanbanActivity({
      cardId,
      userId: user?.id ?? null,
      action: "revision_requested",
      details: notes ? `Revisão solicitada: ${notes}` : "Revisão solicitada pelo cliente",
    });

    await storage.createNotification({
      clientId: card.clientId,
      type: "revision_requested",
      message: `"${card.title}" precisa de revisão${notes ? `: ${notes}` : ""}`,
      recipientRole: "admin",
    });
    await storage.createNotification({
      clientId: card.clientId,
      type: "revision_requested",
      message: `"${card.title}" precisa de revisão${notes ? `: ${notes}` : ""}`,
      recipientRole: "designer",
    });

    res.json(moved);
  });

  /**
   * POST /api/kanban/cards/:id/undo-approval
   * Undoes a previous approval/rejection/revision decision on a Kanban card.
   * Resets status to "Pendente" and moves back to "Em Aprovação" column.
   * Only clients (for their own cards) and admins can undo decisions.
   * Requires authentication.
   */
  app.post("/api/kanban/cards/:id/undo-approval", requireAuth, async (req, res) => {
    const cardId = Number(req.params.id);
    const card = await storage.getKanbanCard(cardId);
    if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

    const user = await getCurrentUser(req);
    if (!user || (user.role !== "client" && user.role !== "admin")) {
      return res.status(403).json({ message: "Apenas clientes e administradores podem desfazer decisões" });
    }
    if (user.role === "client" && user.clientId !== card.clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    if (!card.approvalStatus || card.approvalStatus === "Pendente") {
      return res.status(400).json({ message: "Este cartão não tem uma decisão para desfazer" });
    }

    const previousStatus = card.approvalStatus;

    const updated = await storage.updateKanbanCard(cardId, {
      approvalStatus: "Pendente",
      approvalNotes: null,
      approvalResolvedAt: null,
    });

    const moved = await moveCardToColumn(updated, "Em Aprovação", user?.id);

    await storage.createKanbanActivity({
      cardId,
      userId: user?.id ?? null,
      action: "undo_approval",
      details: `Decisão "${previousStatus}" desfeita, voltou para aprovação`,
    });

    const undoRecipient = user.role === "client" ? "admin" : "client";
    await storage.createNotification({
      clientId: card.clientId,
      kanbanCardId: card.id,
      type: "approval_sent",
      message: `"${card.title}" - decisão desfeita por ${user.name || "Usuário"}, voltou para aprovação`,
      recipientRole: undoRecipient,
    });

    res.json(moved);
  });

  /**
   * POST /api/kanban/cards/:id/attachments
   * Uploads a file attachment to a Kanban card via Google Drive.
   * Generates a thumbnail for image files. Sets card cover if none exists.
   * Requires authentication. Client must have a Drive folder configured.
   */
  app.post("/api/kanban/cards/:id/attachments", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const cardId = Number(req.params.id);
      const card = await storage.getKanbanCard(cardId);
      if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const client = card.clientId ? await storage.getClient(card.clientId) : null;

      if (!client?.driveFolderId) {
        return res.status(400).json({
          message: "Cliente não possui pasta do Google Drive. Sincronize o cliente com o Drive primeiro.",
        });
      }

      let driveResult: { fileId: string; fileUrl: string; downloadUrl: string; extensionFolder: string };
      try {
        driveResult = await uploadKanbanFileToDrive(
          client.driveFolderId,
          file.originalname,
          file.buffer,
          file.mimetype
        );
      } catch (driveErr) {
        console.error("Drive upload failed:", driveErr);
        return res.status(500).json({
          message: "Erro ao enviar arquivo para o Google Drive. Verifique a conexão.",
        });
      }

      let attachments: any[] = [];
      if (card.attachments) {
        try {
          const parsed = JSON.parse(card.attachments);
          attachments = Array.isArray(parsed) ? parsed : [];
        } catch { attachments = []; }
      }

      const attId = randomUUID();
      let thumbnailUrl: string | null = null;
      const isImage = file.mimetype.startsWith("image/");
      if (isImage) {
        thumbnailUrl = await generateThumbnail(file.buffer, attId);
      }

      const newAttachment = {
        id: attId,
        name: file.originalname,
        url: driveResult.fileUrl,
        contentType: file.mimetype,
        size: file.size,
        driveFileId: driveResult.fileId,
        driveUrl: driveResult.fileUrl,
        driveDownloadUrl: driveResult.downloadUrl,
        extensionFolder: driveResult.extensionFolder,
        thumbnailUrl,
        createdAt: new Date().toISOString(),
      };
      attachments.push(newAttachment);

      const updateData: any = { attachments: JSON.stringify(attachments) };
      if (isImage && !card.coverUrl && thumbnailUrl) {
        updateData.coverUrl = thumbnailUrl;
      }
      const updated = await storage.updateKanbanCard(cardId, updateData);
      res.json(updated);
    } catch (err) {
      console.error("Error adding attachment:", err);
      res.status(500).json({ message: "Erro ao adicionar anexo" });
    }
  });

  /**
   * DELETE /api/kanban/cards/:id/attachments/:attachmentId
   * Removes a specific attachment from a Kanban card by attachment ID.
   * Requires authentication.
   */
  app.delete("/api/kanban/cards/:id/attachments/:attachmentId", requireAuth, async (req, res) => {
    try {
      const cardId = Number(req.params.id);
      const { attachmentId } = req.params;
      const card = await storage.getKanbanCard(cardId);
      if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

      let attachments: any[] = [];
      if (card.attachments) {
        try {
          const parsed = JSON.parse(card.attachments);
          attachments = Array.isArray(parsed) ? parsed : [];
        } catch { attachments = []; }
      }

      attachments = attachments.filter((a: any) => a.id !== attachmentId);
      const updated = await storage.updateKanbanCard(cardId, { attachments: JSON.stringify(attachments) });
      res.json(updated);
    } catch (err) {
      console.error("Error removing attachment:", err);
      res.status(500).json({ message: "Erro ao remover anexo" });
    }
  });

  /**
   * GET /api/kanban/drive-folders/:clientId
   * Lists Google Drive extension folders for a client's Kanban files.
   * Requires authentication.
   */
  app.get("/api/kanban/drive-folders/:clientId", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
      if (!client.driveFolderId) return res.json({ folders: [], connected: false });

      const folders = await listKanbanExtensionFolders(client.driveFolderId);
      res.json({ folders, connected: true });
    } catch (err) {
      console.error("Error listing kanban drive folders:", err);
      res.status(500).json({ message: "Erro ao listar pastas do Drive" });
    }
  });

  /**
   * GET /api/kanban/cards/:id/comments
   * Lists all comments on a Kanban card.
   * Requires authentication.
   */
  app.get("/api/kanban/cards/:id/comments", requireAuth, async (req, res) => {
    const comments = await storage.getKanbanComments(Number(req.params.id));
    res.json(comments);
  });

  /**
   * POST /api/kanban/cards/:id/comments
   * Adds a comment to a Kanban card. Creates notifications for relevant roles
   * (client comments notify admin/designer, internal comments notify client and other roles).
   * Requires authentication.
   */
  app.post("/api/kanban/cards/:id/comments", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const cardId = Number(req.params.id);
    const comment = await storage.createKanbanComment({
      cardId,
      userId: user.id,
      content: req.body.content,
    });

    const card = await storage.getKanbanCard(cardId);
    if (card) {
      const commentMsg = `${user.name} comentou em "${card.title}": ${req.body.content.substring(0, 80)}${req.body.content.length > 80 ? "..." : ""}`;
      if (user.role === "client") {
        await storage.createNotification({
          clientId: card.clientId,
          type: "comment_added",
          message: commentMsg,
          recipientRole: "admin",
        });
        await storage.createNotification({
          clientId: card.clientId,
          type: "comment_added",
          message: commentMsg,
          recipientRole: "designer",
        });
      } else {
        await storage.createNotification({
          clientId: card.clientId,
          type: "comment_added",
          message: commentMsg,
          recipientRole: "client",
        });
        if (user.role === "admin") {
          await storage.createNotification({
            clientId: card.clientId,
            type: "comment_added",
            message: commentMsg,
            recipientRole: "designer",
          });
        } else if (user.role === "designer") {
          await storage.createNotification({
            clientId: card.clientId,
            type: "comment_added",
            message: commentMsg,
            recipientRole: "admin",
          });
        }
      }
    }

    res.json(comment);
  });

  /**
   * DELETE /api/kanban/comments/:id
   * Deletes a Kanban card comment.
   * Requires authentication.
   */
  app.delete("/api/kanban/comments/:id", requireAuth, async (req, res) => {
    await storage.deleteKanbanComment(Number(req.params.id));
    res.json({ success: true });
  });

  /**
   * GET /api/kanban/cards/:id/activity
   * Retrieves the activity log (movements, approvals, etc.) for a Kanban card.
   * Requires authentication.
   */
  app.get("/api/kanban/cards/:id/activity", requireAuth, async (req, res) => {
    const activity = await storage.getKanbanActivity(Number(req.params.id));
    res.json(activity);
  });

  /**
   * GET /api/kanban/cards/:id/time-entries
   * Retrieves all time tracking entries for a specific Kanban card.
   * Requires authentication.
   */
  app.get("/api/kanban/cards/:id/time-entries", requireAuth, async (req, res) => {
    const entries = await storage.getKanbanTimeEntries(Number(req.params.id));
    res.json(entries);
  });

  /**
   * GET /api/kanban/client/:clientId/column-times
   * Calculates accumulated time and open timer status per card in the current column
   * for all cards belonging to a client. Excludes timer-excluded columns.
   * Requires authentication.
   */
  app.get("/api/kanban/client/:clientId/column-times", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const cards = await storage.getKanbanCardsByClient(clientId);
      const columns = await storage.getKanbanColumnsByClient(clientId);
      const excludedColIds = new Set(
        columns.filter(c => TIMER_EXCLUDED_COLUMNS.includes(c.title)).map(c => c.id)
      );

      const cardIds = cards.map(c => c.id);
      const allEntries = cardIds.length > 0
        ? await storage.getKanbanTimeEntriesByCardIds(cardIds)
        : [];

      const entriesByCard = new Map<number, typeof allEntries>();
      for (const entry of allEntries) {
        const list = entriesByCard.get(entry.cardId) || [];
        list.push(entry);
        entriesByCard.set(entry.cardId, list);
      }

      const result: Record<number, { accumulatedSeconds: number; openSince: string | null }> = {};

      for (const card of cards) {
        if (excludedColIds.has(card.columnId)) {
          result[card.id] = { accumulatedSeconds: 0, openSince: null };
          continue;
        }

        const entries = entriesByCard.get(card.id) || [];
        const currentColEntries = entries.filter(e => e.columnId === card.columnId);

        let accumulated = 0;
        let openSince: string | null = null;

        for (const entry of currentColEntries) {
          if (entry.totalSeconds != null) {
            accumulated += entry.totalSeconds;
          } else if (!entry.endedAt) {
            openSince = entry.startedAt ? new Date(entry.startedAt).toISOString() : null;
          }
        }

        result[card.id] = { accumulatedSeconds: accumulated, openSince };
      }

      res.json(result);
    } catch (err) {
      console.error("Error getting column times:", err);
      res.status(500).json({ message: "Erro ao buscar tempos" });
    }
  });

  /**
   * GET /api/kanban/reports/designer
   * Generates a time report per designer (internal users), showing total time spent,
   * cards worked on, and per-card breakdowns.
   * Requires internal role (admin/designer).
   */
  app.get("/api/kanban/reports/designer", requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const designers = allUsers.filter(u => isInternalRole(u.role));
      const clientsList = await storage.getClients();

      const report = [];
      for (const designer of designers) {
        const entries = await storage.getTimeEntriesByUser(designer.id);
        const completedEntries = entries.filter(e => e.totalSeconds != null);
        const totalSeconds = completedEntries.reduce((sum, e) => sum + (e.totalSeconds || 0), 0);
        const uniqueCards = Array.from(new Set(entries.map(e => e.cardId)));

        const cardDetails = [];
        for (const cardId of uniqueCards) {
          const card = await storage.getKanbanCard(cardId);
          if (!card) continue;
          const cardEntries = completedEntries.filter(e => e.cardId === cardId);
          const cardTotal = cardEntries.reduce((sum, e) => sum + (e.totalSeconds || 0), 0);
          const client = clientsList.find(c => c.id === card.clientId);
          cardDetails.push({
            cardId: card.id,
            cardTitle: card.title,
            clientName: client?.name || "—",
            clientId: card.clientId,
            totalSeconds: cardTotal,
            entries: cardEntries.length,
          });
        }

        report.push({
          userId: designer.id,
          userName: designer.name,
          totalCards: uniqueCards.length,
          totalSeconds,
          avgSecondsPerCard: uniqueCards.length > 0 ? Math.round(totalSeconds / uniqueCards.length) : 0,
          cards: cardDetails,
        });
      }
      res.json(report);
    } catch (err: any) {
      console.error("Error generating report:", err);
      res.status(500).json({ message: "Erro ao gerar relatório" });
    }
  });

  // === AI AGENT ROUTES ===

  async function checkAiClientAccess(user: any, clientId: number): Promise<boolean> {
    if (user.role === "admin") return true;
    if (user.role === "client") return user.clientId === clientId;
    const access = await storage.getUserClientAccess(user.id);
    if (access.length === 0) return true;
    return access.some(a => a.clientId === clientId);
  }

  function resolveAiClientId(req: any, user: any): number | null {
    if (user.role === "client" && user.clientId) return user.clientId;
    const raw = req.body?.clientId;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }

  app.post("/api/ai/client-overview", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      const clientId = resolveAiClientId(req, user);
      if (!clientId) return res.status(400).json({ message: "clientId é obrigatório" });
      if (!(await checkAiClientAccess(user, clientId))) return res.status(403).json({ message: "Sem permissão para este cliente" });
      const { clientOverview } = await import("./ai-agent");
      const result = await clientOverview(clientId, storage);
      res.json({ result });
    } catch (err: any) {
      console.error("AI client-overview error:", err);
      res.status(500).json({ message: "Erro ao gerar overview" });
    }
  });

  app.post("/api/ai/analyze-competitors", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      const clientId = resolveAiClientId(req, user);
      if (!clientId) return res.status(400).json({ message: "clientId é obrigatório" });
      if (!(await checkAiClientAccess(user, clientId))) return res.status(403).json({ message: "Sem permissão para este cliente" });
      const { analyzeCompetitors } = await import("./ai-agent");
      const result = await analyzeCompetitors(clientId, storage);
      res.json({ result });
    } catch (err: any) {
      console.error("AI analyze-competitors error:", err);
      res.status(500).json({ message: "Erro ao analisar concorrentes" });
    }
  });

  app.post("/api/ai/suggest-content", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      const clientId = resolveAiClientId(req, user);
      if (!clientId) return res.status(400).json({ message: "clientId é obrigatório" });
      if (!(await checkAiClientAccess(user, clientId))) return res.status(403).json({ message: "Sem permissão para este cliente" });
      const quantity = typeof req.body?.quantity === "number" ? Math.min(Math.max(req.body.quantity, 1), 20) : undefined;
      const platform = typeof req.body?.platform === "string" ? req.body.platform.slice(0, 50) : undefined;
      const focus = typeof req.body?.focus === "string" ? req.body.focus.slice(0, 200) : undefined;
      const { suggestContent } = await import("./ai-agent");
      const result = await suggestContent(clientId, storage, { platform, quantity, focus });
      res.json({ result });
    } catch (err: any) {
      console.error("AI suggest-content error:", err);
      res.status(500).json({ message: "Erro ao sugerir conteúdo" });
    }
  });

  app.post("/api/ai/generate-insight", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      const clientId = resolveAiClientId(req, user);
      if (!clientId) return res.status(400).json({ message: "clientId é obrigatório" });
      if (!(await checkAiClientAccess(user, clientId))) return res.status(403).json({ message: "Sem permissão para este cliente" });
      const focus = typeof req.body?.focus === "string" ? req.body.focus.slice(0, 200) : undefined;
      const { generateInsight } = await import("./ai-agent");
      const result = await generateInsight(clientId, storage, focus);
      if (!result.startsWith("⚠️") && !result.startsWith("Cliente não")) {
        await storage.createClientInsight({
          clientId,
          userId: user.id,
          message: result,
        });
        const client = await storage.getClient(clientId);
        if (client) {
          const isInternal = user.role === "admin" || user.role === "designer";
          await storage.createNotification({
            title: "Novo Insight (IA)",
            message: `Insight gerado por IA para ${client.name}`,
            type: "insight",
            recipientRole: isInternal ? "client" : "admin",
            recipientUserId: null,
            relatedClientId: clientId,
          });
        }
      }
      res.json({ result });
    } catch (err: any) {
      console.error("AI generate-insight error:", err);
      res.status(500).json({ message: "Erro ao gerar insight" });
    }
  });

  app.post("/api/ai/weekly-report", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      const clientId = resolveAiClientId(req, user);
      if (!clientId) return res.status(400).json({ message: "clientId é obrigatório" });
      if (!(await checkAiClientAccess(user, clientId))) return res.status(403).json({ message: "Sem permissão para este cliente" });
      const { weeklyReport } = await import("./ai-agent");
      const result = await weeklyReport(clientId, storage);
      res.json({ result });
    } catch (err: any) {
      console.error("AI weekly-report error:", err);
      res.status(500).json({ message: "Erro ao gerar relatório semanal" });
    }
  });

  app.post("/api/ai/activity-report", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      const clientId = resolveAiClientId(req, user);
      if (!clientId) return res.status(400).json({ message: "clientId é obrigatório" });
      if (!(await checkAiClientAccess(user, clientId))) return res.status(403).json({ message: "Sem permissão para este cliente" });
      const validPeriods = ["7d", "15d", "30d"];
      const period = validPeriods.includes(req.body?.period) ? req.body.period : "7d";
      const { activityReport } = await import("./ai-agent");
      const result = await activityReport(clientId, storage, period);
      res.json({ result });
    } catch (err: any) {
      console.error("AI activity-report error:", err);
      res.status(500).json({ message: "Erro ao gerar relatório de acontecimentos" });
    }
  });

  app.post("/api/ai/analyze-productivity", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      if (user.role !== "admin") return res.status(403).json({ message: "Acesso negado" });
      const clientId = resolveAiClientId(req, user);
      if (clientId && !(await checkAiClientAccess(user, clientId))) return res.status(403).json({ message: "Sem permissão para este cliente" });
      const { analyzeProductivity } = await import("./ai-agent");
      const result = await analyzeProductivity(clientId, storage);
      res.json({ result });
    } catch (err: any) {
      console.error("AI analyze-productivity error:", err);
      res.status(500).json({ message: "Erro ao analisar produtividade" });
    }
  });

  app.post("/api/ai/analyze-errors", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      if (user.role !== "admin") return res.status(403).json({ message: "Acesso negado" });
      const { analyzeErrors } = await import("./ai-agent");
      const result = await analyzeErrors(storage);
      res.json({ result });
    } catch (err: any) {
      console.error("AI analyze-errors error:", err);
      res.status(500).json({ message: "Erro ao analisar erros" });
    }
  });

  // === CLIENT ONBOARDING ROUTES ===

  /**
   * Checks if the current user has access to onboarding data for a given client.
   * Internal roles always have access; client users can only access their own client.
   * @param req - Express request object
   * @param clientId - The client ID to check access for
   * @returns True if the user has access, false otherwise
   */
  async function checkOnboardingAccess(req: any, clientId: number): Promise<boolean> {
    const user = await getCurrentUser(req);
    if (!user) return false;
    if (isInternalRole(user.role)) return true;
    if (user.role === "client" && user.clientId === clientId) return true;
    return false;
  }

  /**
   * GET /api/onboarding/:clientId/products
   * Lists all products for a client's onboarding profile.
   * Requires authentication and onboarding access.
   */
  app.get("/api/onboarding/:clientId/products", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const products = await storage.getClientProducts(clientId);
    res.json(products);
  });
  /**
   * POST /api/onboarding/:clientId/products
   * Creates a new product for a client's onboarding profile.
   * Requires authentication and onboarding access.
   */
  app.post("/api/onboarding/:clientId/products", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const parsed = insertClientProductSchema.parse({ clientId, ...req.body });
    const product = await storage.createClientProduct(parsed);
    res.json(product);
  });
  /**
   * PUT /api/onboarding/products/:id
   * Updates an onboarding product by ID.
   * Requires internal role (admin/designer).
   */
  app.put("/api/onboarding/products/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    const product = await storage.updateClientProduct(Number(req.params.id), req.body);
    res.json(product);
  });
  /**
   * DELETE /api/onboarding/products/:id
   * Deletes an onboarding product by ID.
   * Requires internal role (admin/designer).
   */
  app.delete("/api/onboarding/products/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    await storage.deleteClientProduct(Number(req.params.id));
    res.json({ success: true });
  });

  /**
   * GET /api/onboarding/:clientId/services
   * Lists all services for a client's onboarding profile.
   * Requires authentication and onboarding access.
   */
  app.get("/api/onboarding/:clientId/services", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const services = await storage.getClientServices(clientId);
    res.json(services);
  });
  /**
   * POST /api/onboarding/:clientId/services
   * Creates a new service for a client's onboarding profile.
   * Requires authentication and onboarding access.
   */
  app.post("/api/onboarding/:clientId/services", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const parsed = insertClientServiceSchema.parse({ clientId, ...req.body });
    const service = await storage.createClientService(parsed);
    res.json(service);
  });
  /**
   * PUT /api/onboarding/services/:id
   * Updates an onboarding service by ID.
   * Requires internal role (admin/designer).
   */
  app.put("/api/onboarding/services/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    const service = await storage.updateClientService(Number(req.params.id), req.body);
    res.json(service);
  });
  /**
   * DELETE /api/onboarding/services/:id
   * Deletes an onboarding service by ID.
   * Requires internal role (admin/designer).
   */
  app.delete("/api/onboarding/services/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    await storage.deleteClientService(Number(req.params.id));
    res.json({ success: true });
  });

  /**
   * GET /api/onboarding/:clientId/credentials
   * Lists all credentials for a client's onboarding profile.
   * Requires authentication and onboarding access.
   */
  app.get("/api/onboarding/:clientId/credentials", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const creds = await storage.getClientCredentials(clientId);
    res.json(creds);
  });
  /**
   * POST /api/onboarding/:clientId/credentials
   * Creates a new credential for a client's onboarding profile.
   * Requires authentication and onboarding access.
   */
  app.post("/api/onboarding/:clientId/credentials", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const parsed = insertClientCredentialSchema.parse({ clientId, ...req.body });
    const cred = await storage.createClientCredential(parsed);
    res.json(cred);
  });
  /**
   * PUT /api/onboarding/credentials/:id
   * Updates an onboarding credential by ID.
   * Requires internal role (admin/designer).
   */
  app.put("/api/onboarding/credentials/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    const cred = await storage.updateClientCredential(Number(req.params.id), req.body);
    res.json(cred);
  });
  /**
   * DELETE /api/onboarding/credentials/:id
   * Deletes an onboarding credential by ID.
   * Requires internal role (admin/designer).
   */
  app.delete("/api/onboarding/credentials/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    await storage.deleteClientCredential(Number(req.params.id));
    res.json({ success: true });
  });

  /**
   * GET /api/onboarding/:clientId/text-templates
   * Lists all text templates for a client's onboarding profile.
   * Requires authentication.
   */
  app.get("/api/onboarding/:clientId/text-templates", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const templates = await storage.getClientTextTemplates(clientId);
    res.json(templates);
  });
  /**
   * POST /api/onboarding/:clientId/text-templates
   * Creates a new text template for a client's onboarding profile.
   * Requires authentication and onboarding access.
   */
  app.post("/api/onboarding/:clientId/text-templates", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const template = await storage.createClientTextTemplate({ clientId, ...req.body });
    res.json(template);
  });
  /**
   * PUT /api/onboarding/text-templates/:id
   * Updates an onboarding text template by ID.
   * Requires internal role (admin/designer).
   */
  app.put("/api/onboarding/text-templates/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    const template = await storage.updateClientTextTemplate(Number(req.params.id), req.body);
    res.json(template);
  });
  /**
   * DELETE /api/onboarding/text-templates/:id
   * Deletes an onboarding text template by ID.
   * Requires internal role (admin/designer).
   */
  app.delete("/api/onboarding/text-templates/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    await storage.deleteClientTextTemplate(Number(req.params.id));
    res.json({ success: true });
  });

  /**
   * GET /api/insights/all
   * Lists all client insights, enriched with user and client names.
   * Clients see only their own insights; internal roles see all.
   * Requires authentication.
   */
  app.get("/api/insights/all", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const allUsers = await storage.getUsers();
    const userMap: Record<number, string> = {};
    allUsers.forEach(u => { userMap[u.id] = u.name; });
    let insights: any[];
    if (user.role === "client" && user.clientId) {
      insights = await storage.getClientInsights(user.clientId);
    } else {
      insights = await storage.getAllClientInsights();
    }
    const clients = await storage.getClients();
    const clientMap: Record<number, string> = {};
    clients.forEach(c => { clientMap[c.id] = c.name; });
    const enriched = insights.map(i => ({ ...i, userName: userMap[i.userId] || "Desconhecido", clientName: clientMap[i.clientId] || "Cliente" }));
    res.json(enriched);
  });

  /**
   * GET /api/onboarding/:clientId/insights
   * Lists all insights for a specific client, enriched with user names.
   * Requires authentication and onboarding access.
   */
  app.get("/api/onboarding/:clientId/insights", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const insights = await storage.getClientInsights(clientId);
    const allUsers = await storage.getUsers();
    const userMap: Record<number, string> = {};
    allUsers.forEach(u => { userMap[u.id] = u.name; });
    const enriched = insights.map(i => ({ ...i, userName: userMap[i.userId] || "Desconhecido" }));
    res.json(enriched);
  });
  /**
   * POST /api/onboarding/:clientId/insights
   * Creates a new insight for a client. Sends notifications to relevant roles.
   * Requires authentication and onboarding access.
   */
  app.post("/api/onboarding/:clientId/insights", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const message = z.string().min(1).parse(req.body.message);
    const insight = await storage.createClientInsight({ clientId, userId: user.id, message });
    const client = await storage.getClient(clientId);
    const notifMsg = `${user.name} postou um insight${client ? ` em ${client.name}` : ""}: "${message.substring(0, 60)}..."`;
    if (user.role === "client") {
      await storage.createNotification({ clientId, type: "insight", message: notifMsg, recipientRole: "admin", isRead: false });
      await storage.createNotification({ clientId, type: "insight", message: notifMsg, recipientRole: "designer", isRead: false });
    } else {
      await storage.createNotification({ clientId, type: "insight", message: notifMsg, recipientRole: "client", isRead: false });
    }
    res.json({ ...insight, userName: user.name });
  });
  app.delete("/api/onboarding/insights/:id", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const insightId = Number(req.params.id);
    if (isInternalRole(user.role)) {
      await storage.deleteClientInsight(insightId);
      return res.json({ success: true });
    }
    if (user.role === "client" && user.clientId) {
      const allInsights = await storage.getClientInsights(user.clientId);
      const insight = allInsights.find(i => i.id === insightId);
      if (insight && insight.userId === user.id) {
        await storage.deleteClientInsight(insightId);
        return res.json({ success: true });
      }
    }
    return res.status(403).json({ message: "Sem permissão para apagar este insight" });
  });

  /**
   * GET /api/onboarding/:clientId/access
   * Lists user IDs that have onboarding access for a client.
   * Requires admin role.
   */
  app.get("/api/onboarding/:clientId/access", requireAuth, requireRole(["admin"]), async (req, res) => {
    const access = await storage.getOnboardingAccess(Number(req.params.clientId));
    res.json(access.map(a => a.userId));
  });
  /**
   * PUT /api/onboarding/:clientId/access
   * Sets the list of user IDs that have onboarding access for a client.
   * Requires admin role.
   */
  app.put("/api/onboarding/:clientId/access", requireAuth, requireRole(["admin"]), async (req, res) => {
    const { userIds } = req.body;
    await storage.setOnboardingAccess(Number(req.params.clientId), userIds || []);
    res.json({ success: true, userIds });
  });

  /**
   * PUT /api/clients/:id/about
   * Updates the "about" description of a client.
   * Requires authentication and onboarding access.
   */
  app.put("/api/clients/:id/about", requireAuth, async (req, res) => {
    const clientId = Number(req.params.id);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const about = z.string().optional().parse(req.body.about);
    const updated = await storage.updateClient(clientId, { about: about || null });
    res.json(updated);
  });

  /**
   * PUT /api/clients/:id/notes
   * Updates the notes field of a client.
   * Requires authentication and onboarding access.
   */
  app.put("/api/clients/:id/notes", requireAuth, async (req, res) => {
    const clientId = Number(req.params.id);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const notes = z.string().optional().parse(req.body.notes);
    const updated = await storage.updateClient(clientId, { notes: notes || null });
    res.json(updated);
  });

  /**
   * PUT /api/clients/:id/tags
   * Updates the tags array of a client.
   * Requires authentication and onboarding access.
   */
  app.put("/api/clients/:id/tags", requireAuth, async (req, res) => {
    const clientId = Number(req.params.id);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const tags = z.array(z.string()).optional().parse(req.body.tags);
    const updated = await storage.updateClient(clientId, { tags: tags || null });
    res.json(updated);
  });

  /**
   * PUT /api/clients/:id/market-tags
   * Updates the market tags array of a client.
   * Requires authentication and onboarding access.
   */
  app.put("/api/clients/:id/market-tags", requireAuth, async (req, res) => {
    const clientId = Number(req.params.id);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const marketTags = z.array(z.string()).optional().parse(req.body.marketTags);
    const updated = await storage.updateClient(clientId, { marketTags: marketTags || null });
    res.json(updated);
  });

  /**
   * POST /api/clients/:id/suggest-tags
   * Uses OpenAI to suggest relevant tags for a client based on their profile.
   * Requires authentication and onboarding access.
   */
  app.post("/api/clients/:id/suggest-tags", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.id);
      if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
      const { suggestTags } = await import("./openai");
      const suggestions = await suggestTags(
        client.name,
        client.about || "",
        client.notes || "",
        client.tags || []
      );
      res.json({ suggestions });
    } catch (err: any) {
      console.error("Error suggesting tags:", err);
      res.status(500).json({ message: "Erro ao gerar sugestões de tags" });
    }
  });

  /**
   * POST /api/clients/:id/suggest-market-tags
   * Uses OpenAI to suggest relevant market tags for a client based on their profile.
   * Requires authentication and onboarding access.
   */
  app.post("/api/clients/:id/suggest-market-tags", requireAuth, async (req, res) => {
    try {
      const clientId = Number(req.params.id);
      if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
      const { suggestMarketTags } = await import("./openai");
      const suggestions = await suggestMarketTags(
        client.name,
        client.about || "",
        client.notes || "",
        client.marketTags || []
      );
      res.json({ suggestions });
    } catch (err: any) {
      console.error("Error suggesting market tags:", err);
      res.status(500).json({ message: "Erro ao gerar sugestões de termos de mercado" });
    }
  });

  /**
   * PUT /api/clients/:id/kanban-bg
   * Updates the Kanban board background color and/or image for a client.
   * Requires internal role (admin/designer).
   */
  app.put("/api/clients/:id/kanban-bg", requireRole(...INTERNAL_ROLES), async (req, res) => {
    const clientId = Number(req.params.id);
    const { kanbanBgColor, kanbanBgImage } = req.body;
    const updated = await storage.updateClient(clientId, {
      kanbanBgColor: kanbanBgColor || null,
      kanbanBgImage: kanbanBgImage || null,
    });
    res.json(updated);
  });

  /**
   * GET /api/thumbnails/:filename
   * Serves a cached thumbnail image file. Returns 404 if not found.
   * Public endpoint (no auth required). Responses are cached for 1 year.
   */
  app.get("/api/thumbnails/:filename", (req, res) => {
    const filename = req.params.filename;
    if (filename.includes("..") || filename.includes("/")) {
      return res.status(400).json({ message: "Invalid filename" });
    }
    const filePath = path.join(THUMBNAILS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Thumbnail not found" });
    }
    res.set("Content-Type", "image/webp");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(filePath);
  });

  /**
   * GET /api/drive-proxy/:fileId
   * Proxies a Google Drive file stream to the client. Client users can only access
   * files attached to their own Kanban cards. Sets content-type and caching headers.
   * Requires authentication.
   */
  app.get("/api/drive-proxy/:fileId", requireAuth, async (req, res) => {
    try {
      const { fileId } = req.params;
      if (!fileId) return res.status(400).json({ message: "File ID obrigatório" });

      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      if (user.role === "client" && user.clientId) {
        const clientCards = await storage.getKanbanCardsByClient(user.clientId);
        const hasAccess = clientCards.some(card => {
          if (!card.attachments) return false;
          try {
            const atts = JSON.parse(card.attachments as string);
            return Array.isArray(atts) && atts.some((a: any) => a.driveFileId === fileId);
          } catch { return false; }
        });
        if (!hasAccess) return res.status(404).json({ message: "Arquivo não encontrado" });
      }

      const { stream, mimeType, name } = await getDriveFileStream(fileId);
      res.set("Content-Type", mimeType);
      res.set("Cache-Control", "private, max-age=3600");
      res.set("Content-Disposition", `inline; filename="${encodeURIComponent(name)}"`);
      stream.pipe(res);
    } catch (err: any) {
      console.error("Drive proxy error:", err?.message);
      res.status(500).json({ message: "Erro ao carregar arquivo do Drive" });
    }
  });

  /**
   * POST /api/kanban/cards/:id/cover-upload
   * Uploads an image file as the cover of a Kanban card. Uploads to Google Drive,
   * generates thumbnails (standard + cover-sized), and updates the card.
   * Requires authentication. Only image files are accepted.
   */
  app.post("/api/kanban/cards/:id/cover-upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const cardId = Number(req.params.id);
      const card = await storage.getKanbanCard(cardId);
      if (!card) return res.status(404).json({ message: "Cartão não encontrado" });

      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      const isImage = file.mimetype.startsWith("image/");
      if (!isImage) return res.status(400).json({ message: "Apenas imagens são permitidas como capa" });

      const client = card.clientId ? await storage.getClient(card.clientId) : null;
      if (!client?.driveFolderId) {
        return res.status(400).json({ message: "Cliente não possui pasta do Google Drive." });
      }

      let driveResult: { fileId: string; fileUrl: string; downloadUrl: string; extensionFolder: string };
      try {
        driveResult = await uploadKanbanFileToDrive(
          client.driveFolderId,
          file.originalname,
          file.buffer,
          file.mimetype
        );
      } catch (driveErr) {
        console.error("Drive upload failed:", driveErr);
        return res.status(500).json({ message: "Erro ao enviar arquivo para o Google Drive." });
      }

      const attachmentId = randomUUID();
      const thumbnailUrl = await generateThumbnail(file.buffer, attachmentId);
      const coverThumbId = `cover-${attachmentId}`;
      const coverThumbUrl = await generateThumbnail(file.buffer, coverThumbId, 400, 200, 55);

      let attachments: any[] = [];
      if (card.attachments) {
        try {
          const parsed = JSON.parse(card.attachments);
          attachments = Array.isArray(parsed) ? parsed : [];
        } catch { attachments = []; }
      }

      const newAttachment = {
        id: attachmentId,
        name: file.originalname,
        url: driveResult.fileUrl,
        contentType: file.mimetype,
        size: file.size,
        driveFileId: driveResult.fileId,
        driveUrl: driveResult.fileUrl,
        driveDownloadUrl: driveResult.downloadUrl,
        extensionFolder: driveResult.extensionFolder,
        thumbnailUrl,
        createdAt: new Date().toISOString(),
      };
      attachments.push(newAttachment);

      const updated = await storage.updateKanbanCard(cardId, {
        attachments: JSON.stringify(attachments),
        coverUrl: coverThumbUrl || thumbnailUrl,
      });

      res.json(updated);
    } catch (err) {
      console.error("Error uploading cover:", err);
      res.status(500).json({ message: "Erro ao enviar capa" });
    }
  });

  registerLocalStorageRoutes(app);

  // === CARD TIME REPORT ===

  /**
   * GET /api/reports/card-times
   * Generates a detailed time report for Kanban cards, showing time spent per column.
   * Can be filtered by clientId. Results sorted by total time descending.
   * Requires internal role (admin/designer).
   */
  app.get("/api/reports/card-times", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const { clientId } = req.query;
      let allCards: any[] = [];

      if (clientId) {
        allCards = await storage.getKanbanCardsByClient(Number(clientId));
      } else {
        const clients = await storage.getClients();
        for (const client of clients) {
          const cards = await storage.getKanbanCardsByClient(client.id);
          allCards.push(...cards);
        }
      }

      if (allCards.length === 0) {
        return res.json([]);
      }

      const cardIds = allCards.map(c => c.id);
      const allEntries = await storage.getKanbanTimeEntriesByCardIds(cardIds);

      const clientIds = [...new Set(allCards.map(c => c.clientId))];
      const clientMap = new Map<number, string>();
      const columnMap = new Map<number, string>();

      for (const cId of clientIds) {
        const client = await storage.getClient(cId);
        if (client) clientMap.set(cId, client.name);
        const cols = await storage.getKanbanColumnsByClient(cId);
        for (const col of cols) {
          columnMap.set(col.id, col.title);
        }
      }

      const entriesByCard = new Map<number, typeof allEntries>();
      for (const entry of allEntries) {
        const list = entriesByCard.get(entry.cardId) || [];
        list.push(entry);
        entriesByCard.set(entry.cardId, list);
      }

      const result = allCards.map(card => {
        const entries = entriesByCard.get(card.id) || [];

        const byColumn: Record<string, { totalSeconds: number; entries: number; openSince: string | null }> = {};
        const now = Date.now();

        for (const entry of entries) {
          const colName = entry.columnId ? (columnMap.get(entry.columnId) || `Col ${entry.columnId}`) : "Desconhecida";
          if (!byColumn[colName]) {
            byColumn[colName] = { totalSeconds: 0, entries: 0, openSince: null };
          }
          if (entry.totalSeconds != null) {
            byColumn[colName].totalSeconds += entry.totalSeconds;
            byColumn[colName].entries += 1;
          } else if (!entry.endedAt && entry.startedAt) {
            const elapsed = Math.max(0, Math.floor((now - new Date(entry.startedAt).getTime()) / 1000));
            byColumn[colName].totalSeconds += elapsed;
            byColumn[colName].openSince = new Date(entry.startedAt).toISOString();
          }
        }

        let totalSeconds = 0;
        for (const col of Object.values(byColumn)) {
          totalSeconds += col.totalSeconds;
        }
        const currentColName = columnMap.get(card.columnId) || "Desconhecida";

        return {
          cardId: card.id,
          cardTitle: card.title,
          cardType: card.cardType || "geral",
          clientId: card.clientId,
          clientName: clientMap.get(card.clientId) || "",
          currentColumn: currentColName,
          totalSeconds,
          columnTimes: byColumn,
        };
      });

      result.sort((a, b) => b.totalSeconds - a.totalSeconds);
      res.json(result);
    } catch (err) {
      console.error("Error getting card time report:", err);
      res.status(500).json({ message: "Erro ao gerar relatório" });
    }
  });

  // === WORKFLOW REPORTS ===

  /**
   * GET /api/reports/workflow
   * Generates a workflow report with filters for client, card type, assigned user, and date range.
   * Requires internal role (admin/designer).
   */
  app.get("/api/reports/workflow", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const { clientId, cardType, assignedUserId, startDate, endDate } = req.query;
      const data = await storage.getWorkflowReportData({
        clientId: clientId ? Number(clientId) : undefined,
        cardType: cardType as string | undefined,
        assignedUserId: assignedUserId ? Number(assignedUserId) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.json(data);
    } catch (err) {
      console.error("Error getting workflow report:", err);
      res.status(500).json({ message: "Erro ao gerar relatório" });
    }
  });

  /**
   * GET /api/reports/movements
   * Generates a movement report showing card transitions between columns.
   * Filterable by client, user, and date range.
   * Requires internal role (admin/designer).
   */
  app.get("/api/reports/movements", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const { clientId, userId, startDate, endDate } = req.query;
      const data = await storage.getMovementReportData({
        clientId: clientId ? Number(clientId) : undefined,
        userId: userId ? Number(userId) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.json(data);
    } catch (err) {
      console.error("Error getting movement report:", err);
      res.status(500).json({ message: "Erro ao gerar relatório de movimentações" });
    }
  });

  app.get("/api/reports/client-activity", requireAuth, async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Não autenticado" });

      const { clientId, month, year } = req.query;
      const targetClientId = clientId ? Number(clientId) : null;

      if (user.role === "client") {
        if (!user.clientId) {
          return res.status(403).json({ message: "Sem permissão" });
        }
        if (targetClientId && targetClientId !== user.clientId) {
          return res.status(403).json({ message: "Sem permissão para acessar dados de outro cliente" });
        }
      }

      const now = new Date();
      const targetMonth = month ? Number(month) - 1 : now.getMonth();
      const targetYear = year ? Number(year) : now.getFullYear();
      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      let clientIds: number[] = [];
      if (user.role === "client" && user.clientId) {
        clientIds = [user.clientId];
      } else if (targetClientId) {
        clientIds = [targetClientId];
      } else if (isInternalRole(user.role)) {
        const allClients = await storage.getClients();
        clientIds = allClients.map(c => c.id);
      }

      const results = [];
      for (const cId of clientIds) {
        const client = await storage.getClient(cId);
        if (!client) continue;

        const columns = await storage.getKanbanColumnsByClient(cId);
        const allCards = await storage.getKanbanCardsByClient(cId);

        const cardsInPeriod = allCards.filter(c => {
          const created = new Date(c.createdAt!);
          return created >= startDate && created <= endDate;
        });

        const columnMap = new Map(columns.map(c => [c.id, c.title]));

        const approvedCards = cardsInPeriod.filter(c => c.approvalStatus === "Aprovado");
        const pendingCards = cardsInPeriod.filter(c => c.approvalStatus === "Pendente");
        const revisionCards = cardsInPeriod.filter(c => c.approvalStatus === "Revisão");
        const rejectedCards = cardsInPeriod.filter(c => c.approvalStatus === "Reprovado");

        const scheduledCards = cardsInPeriod.filter(c => columnMap.get(c.columnId) === "Agendados");
        const postedCards = cardsInPeriod.filter(c => columnMap.get(c.columnId) === "Postados");
        const finishedCards = cardsInPeriod.filter(c => columnMap.get(c.columnId) === "Finalizados");

        const posts = await storage.getPostsByClient(cId);
        const postsInPeriod = posts.filter(p => {
          const created = new Date(p.createdAt!);
          return created >= startDate && created <= endDate;
        });

        const scheduledPosts = postsInPeriod.filter(p => p.status === "agendado");
        const publishedPosts = postsInPeriod.filter(p => p.status === "publicado");

        const byType: Record<string, number> = {};
        for (const card of cardsInPeriod) {
          const t = card.cardType || "geral";
          byType[t] = (byType[t] || 0) + 1;
        }

        const byPlatform: Record<string, number> = {};
        for (const post of postsInPeriod) {
          const platforms = post.platform;
          if (Array.isArray(platforms)) {
            for (const p of platforms) {
              const val = Array.isArray(p) ? p[0] : p;
              if (val && typeof val === "string") {
                const normalized = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
                byPlatform[normalized] = (byPlatform[normalized] || 0) + 1;
              }
            }
          }
        }

        results.push({
          clientId: cId,
          clientName: client.name,
          clientLogoUrl: client.logoUrl,
          period: { month: targetMonth + 1, year: targetYear },
          totalCardsCreated: cardsInPeriod.length,
          totalCardsAll: allCards.length,
          approvedCount: approvedCards.length,
          pendingApprovalCount: pendingCards.length,
          scheduledCount: scheduledCards.length,
          postedCount: postedCards.length,
          finishedCount: finishedCards.length,
          revisionCount: revisionCards.length,
          rejectedCount: rejectedCards.length,
          totalPostsCreated: postsInPeriod.length,
          scheduledPostsCount: scheduledPosts.length,
          publishedPostsCount: publishedPosts.length,
          byType,
          byPlatform,
        });
      }

      res.json(results);
    } catch (err) {
      console.error("Error getting client activity report:", err);
      res.status(500).json({ message: "Erro ao gerar relatório de atividade" });
    }
  });

  // === BRAND IDENTITY FILES ===
  app.get("/api/clients/:clientId/brand-identity", requireAuth, async (req, res) => {
    try {
      const files = await storage.getBrandIdentityFiles(Number(req.params.clientId));
      res.json(files);
    } catch (err) {
      console.error("Error getting brand identity files:", err);
      res.status(500).json({ message: "Erro ao buscar arquivos de identidade visual" });
    }
  });

  /**
   * POST /api/clients/:clientId/brand-identity
   * Uploads a brand identity file for a client to Google Drive.
   * Requires authentication and internal role or client role.
   * Google Drive must be connected and client must have a Drive folder.
   */
  app.post("/api/clients/:clientId/brand-identity", requireAuth, requireRole(...INTERNAL_ROLES, "client"), upload.single("file"), async (req, res) => {
    try {
      const clientId = Number(req.params.clientId);
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Arquivo é obrigatório" });

      const driveConnected = await isDriveConnected();
      if (!driveConnected) {
        return res.status(400).json({ message: "Google Drive não está conectado. Arquivos de identidade visual são armazenados exclusivamente no Drive." });
      }

      const client = await storage.getClient(clientId);
      if (!client?.driveFolderId) {
        return res.status(400).json({ message: "Este cliente não possui pasta configurada no Google Drive. Configure a pasta do cliente primeiro." });
      }

      const result = await uploadKanbanFileToDrive(client.driveFolderId, file.originalname, file.buffer, file.mimetype);

      const brandFile = await storage.createBrandIdentityFile({
        clientId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        driveFileId: result.fileId,
        driveUrl: result.fileUrl,
        category: req.body.category || "geral",
        uploadedBy: (req as any).user?.id || null,
      });

      res.json(brandFile);
    } catch (err) {
      console.error("Error uploading brand identity file:", err);
      res.status(500).json({ message: "Erro ao enviar arquivo de identidade visual" });
    }
  });

  /**
   * DELETE /api/brand-identity/:id
   * Deletes a brand identity file record and removes the file from Google Drive.
   * Requires internal role (admin/designer).
   */
  app.delete("/api/brand-identity/:id", requireAuth, requireRole(...INTERNAL_ROLES), async (req, res) => {
    try {
      const fileRecord = await storage.getBrandIdentityFile(Number(req.params.id));
      if (!fileRecord) return res.status(404).json({ message: "Arquivo não encontrado" });

      if (fileRecord.driveFileId) {
        try {
          const driveConnected = await isDriveConnected();
          if (driveConnected) {
            await deleteDriveFile(fileRecord.driveFileId);
          }
        } catch (driveErr) {
          console.error("Error deleting file from Drive:", driveErr);
        }
      }

      await storage.deleteBrandIdentityFile(Number(req.params.id));
      res.json({ message: "Arquivo removido" });
    } catch (err) {
      console.error("Error deleting brand identity file:", err);
      res.status(500).json({ message: "Erro ao remover arquivo" });
    }
  });

  // === ERROR REPORTS ===

  /**
   * GET /api/error-reports
   * Lists error reports with optional filters for status and date range.
   * Requires admin role.
   */
  app.get("/api/error-reports", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { status, startDate, endDate } = req.query;
      const reports = await storage.getErrorReports({
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      res.json(reports);
    } catch (err) {
      console.error("Error getting error reports:", err);
      res.status(500).json({ message: "Erro ao buscar relatórios de erro" });
    }
  });

  app.post("/api/error-reports", requireAuth, async (req, res) => {
    try {
      const report = await storage.createErrorReport({
        ...req.body,
        reporterUserId: (req as any).user?.id || null,
      });
      res.json(report);
    } catch (err) {
      console.error("Error creating error report:", err);
      res.status(500).json({ message: "Erro ao registrar relatório de erro" });
    }
  });

  /**
   * PATCH /api/error-reports/:id
   * Updates an error report. If status is set to "resolvido", records who resolved it and when.
   * Requires admin role.
   */
  app.patch("/api/error-reports/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const updates: any = { ...req.body };
      if (updates.status === "resolvido") {
        updates.resolvedBy = (req as any).user?.id;
        updates.resolvedAt = new Date();
      }
      const report = await storage.updateErrorReport(Number(req.params.id), updates);
      res.json(report);
    } catch (err) {
      console.error("Error updating error report:", err);
      res.status(500).json({ message: "Erro ao atualizar relatório de erro" });
    }
  });

  /**
   * GET /api/documentacao
   * Serves the DOCUMENTACAO.md file as plain text.
   * Requires authentication.
   */
  app.get("/api/documentacao", requireAuth, async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.resolve("DOCUMENTACAO.md");
      const content = fs.readFileSync(filePath, "utf-8");
      res.type("text/plain").send(content);
    } catch (err) {
      res.status(404).send("Documentação não encontrada");
    }
  });

  await seedDatabase();

  return httpServer;
}

/**
 * Seeds the database with initial sample data if no clients or users exist.
 * Creates sample clients (Moda Bella, TechSafe Solutions, Sabor & Arte),
 * sample posts, and a default admin user.
 */
async function seedDatabase() {
  const existingClients = await storage.getClients();
  if (existingClients.length === 0) {
    const clientA = await storage.createClient({
      name: "Moda Bella",
      contactName: "Ana Silva",
      email: "ana@modabella.com.br",
      phone: "(11) 99999-1234",
      instagram: "@modabella",
      notes: "Cliente desde 2024. Foco em moda feminina.",
      isActive: true,
    });

    const clientB = await storage.createClient({
      name: "TechSafe Solutions",
      contactName: "Carlos Mendes",
      email: "carlos@techsafe.com.br",
      phone: "(21) 98888-5678",
      instagram: "@techsafe",
      notes: "Empresa de segurança digital. Conteúdo técnico.",
      isActive: true,
    });

    const clientC = await storage.createClient({
      name: "Sabor & Arte Restaurante",
      contactName: "Juliana Costa",
      email: "juliana@saborarte.com.br",
      phone: "(31) 97777-9012",
      instagram: "@saborarte",
      notes: "Restaurante gourmet. Posts de pratos e eventos.",
      isActive: true,
    });

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingPosts = await storage.getPosts();
    if (existingPosts.length === 0) {
      await storage.createPost({
        clientId: clientA.id,
        clientName: clientA.name,
        title: "Lançamento Coleção Verão",
        content: "Confira as novidades da nossa coleção de verão! #moda #verao",
        platform: ["Instagram"],
        scheduledDate: tomorrow,
        status: "Agendado",
        mediaUrl: "https://example.com/image1.jpg",
        notes: "Aguardando aprovação final da arte",
      });

      await storage.createPost({
        clientId: clientB.id,
        clientName: clientB.name,
        title: "Dicas de Segurança Cibernética",
        content: "5 dicas para proteger seus dados online.",
        platform: ["LinkedIn"],
        scheduledDate: new Date(now.getTime() + 86400000 * 2),
        status: "Agendado",
        notes: "Pesquisar mais estatísticas",
      });

      await storage.createPost({
        clientId: clientC.id,
        clientName: clientC.name,
        title: "Festival Gastronômico",
        content: "Venha participar do nosso festival com pratos exclusivos!",
        platform: ["Facebook", "Instagram"],
        scheduledDate: new Date(now.getTime() - 86400000),
        status: "Publicado",
      });
    }
  }

  const existingUsers = await storage.getUsers();
  if (existingUsers.length === 0) {
    const { hashPassword } = await import("./auth");
    await storage.createUser({
      name: "Administrador",
      email: "admin@shift.agency",
      password: await hashPassword("admin123"),
      role: "admin",
      clientId: null,
      isActive: true,
    });
  }
}
