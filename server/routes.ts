import type { Express } from "express";
import type { Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { loginSchema, registerSchema, DEFAULT_KANBAN_COLUMNS, TIMED_COLUMNS, APPROVAL_STATUS_TO_COLUMN, PROTECTED_KANBAN_COLUMNS, insertClientProductSchema, insertClientServiceSchema, insertClientCredentialSchema, insertClientInsightSchema } from "@shared/schema";
import { z } from "zod";
import { hashPassword, verifyPassword, requireAuth, requireRole, getCurrentUser } from "./auth";
import { registerLocalStorageRoutes } from "./local-storage";
import { createClientFolder, createApprovalSubfolder, uploadImageFromUrl, listDriveFiles, getDriveFileDownloadUrl, listApprovalVersionFolders, isDriveConnected, getDriveUserInfo, uploadKanbanFileToDrive, listKanbanExtensionFolders, deleteDriveFile, resetOAuth2Client } from "./google-drive";
import multer from "multer";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const THUMBNAILS_DIR = path.join(process.cwd(), "server", "thumbnails");
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

const loginAttempts = new Map<string, { count: number; firstAttempt: number; blockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.firstAttempt > WINDOW_MS && now > data.blockedUntil) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 1000);

function getClientIp(req: any): string {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.connection?.remoteAddress || "unknown";
}

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

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const data = loginAttempts.get(ip);
  if (!data) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now, blockedUntil: 0 });
  } else {
    data.count++;
  }
}

function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

async function generateThumbnail(buffer: Buffer, attachmentId: string, width = 300, height = 300): Promise<string | null> {
  try {
    const thumbPath = path.join(THUMBNAILS_DIR, `${attachmentId}.webp`);
    await sharp(buffer)
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(thumbPath);
    return `/api/thumbnails/${attachmentId}.webp`;
  } catch (err) {
    console.warn("Thumbnail generation failed:", err);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === AUTH ROUTES ===

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

  app.post("/api/auth/logout", (req, res) => {
    (req as any).session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao sair" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logout realizado" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  // === USER MANAGEMENT (admin only) ===

  app.get("/api/users", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    if (user.role !== "admin" && user.role !== "designer" && !user.isManager) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const allUsers = await storage.getUsers();
    const safeUsers = allUsers.map(({ password: _, ...u }) => u);
    res.json(safeUsers);
  });

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
    const post = await storage.getPost(Number(req.params.id));
    if (!post) {
      return res.status(404).json({ message: 'Post não encontrado' });
    }
    res.json(post);
  });

  app.post(api.posts.create.path, requireRole("admin", "designer"), async (req, res) => {
    try {
      if (req.body.platform && typeof req.body.platform === 'string') {
        req.body.platform = [req.body.platform];
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

  app.put(api.posts.update.path, requireRole("admin", "designer"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existingPost = await storage.getPost(id);
      if (!existingPost) {
        return res.status(404).json({ message: 'Post não encontrado' });
      }
      if (req.body.platform && typeof req.body.platform === 'string') {
        req.body.platform = [req.body.platform];
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

        if (oldColumn && TIMED_COLUMNS.includes(oldColumn.title)) {
          const openEntry = await storage.getOpenTimeEntry(existingCard.id);
          if (openEntry) await storage.stopTimeEntry(openEntry.id);
        }
        if (TIMED_COLUMNS.includes(targetColumnTitle) && userId) {
          await storage.startTimeEntry(existingCard.id, userId);
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

  app.get(api.approvals.list.path, requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });

    let approvals;
    if (user.role === "client" && user.clientId) {
      approvals = await storage.getApprovalPostsByClient(user.clientId);
    } else if (user.role === "designer") {
      approvals = await storage.getApprovalPostsByDesigner(user.id);
    } else {
      approvals = await storage.getApprovalPosts();
    }
    res.json(approvals);
  });

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

  app.get("/api/approvals/approved", requireRole("admin", "designer"), async (_req, res) => {
    const allApprovals = await storage.getApprovalPosts();
    const approved = allApprovals.filter(a => a.status === "Aprovado");
    res.json(approved);
  });

  app.get("/api/kanban/approved-cards", requireRole("admin", "designer"), async (_req, res) => {
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

  app.get(api.approvals.get.path, requireAuth, async (req, res) => {
    const approval = await storage.getApprovalPost(Number(req.params.id));
    if (!approval) {
      return res.status(404).json({ message: 'Postagem não encontrada' });
    }
    res.json(approval);
  });

  app.post(api.approvals.create.path, requireRole("admin", "designer"), async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      const body = { ...req.body };
      if (user && user.role === "designer") {
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

            const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
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

  app.post("/api/posts/import-approval", requireRole("admin", "designer"), async (req, res) => {
    try {
      const importSchema = z.object({
        approvalPostId: z.number({ required_error: "ID da aprovação é obrigatório" }),
        scheduledDate: z.string().optional(),
        platform: z.array(z.string()).optional(),
        content: z.string().optional(),
        status: z.enum(["Agendado", "Rascunho"]).optional(),
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

  app.post("/api/posts/import-kanban-card", requireRole("admin", "designer"), async (req, res) => {
    try {
      const importSchema = z.object({
        kanbanCardId: z.number({ required_error: "ID do card é obrigatório" }),
        scheduledDate: z.string(),
        platform: z.array(z.string()).min(1, "Selecione ao menos uma plataforma"),
        content: z.string().optional(),
        status: z.enum(["Agendado", "Rascunho"]).optional(),
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

  // === NOTIFICATIONS ROUTES ===

  app.get("/api/notifications", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const allNotifications = await storage.getNotifications();
    const filtered = allNotifications.filter(n => {
      if (n.recipientUserId === user.id) return true;
      if (user.role === "admin" && (!n.recipientRole || n.recipientRole === "admin" || n.recipientRole === "all")) return true;
      if (n.recipientRole === user.role) return true;
      if (n.recipientRole === "all") return true;
      if (user.role === "client" && n.recipientRole === "client" && n.clientId && user.clientId === n.clientId) return true;
      return false;
    });
    res.json(filtered);
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const allNotifications = await storage.getNotifications();
    const filtered = allNotifications.filter(n => {
      if (n.isRead) return false;
      if (n.recipientUserId === user.id) return true;
      if (user.role === "admin" && (!n.recipientRole || n.recipientRole === "admin" || n.recipientRole === "all")) return true;
      if (n.recipientRole === user.role) return true;
      if (n.recipientRole === "all") return true;
      if (user.role === "client" && n.recipientRole === "client" && n.clientId && user.clientId === n.clientId) return true;
      return false;
    });
    res.json({ count: filtered.length });
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.markNotificationRead(id);
    res.json(updated);
  });

  app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    await storage.markAllNotificationsRead(user.id);
    res.json({ success: true });
  });

  // === COMPETITORS ===

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

  app.get("/api/competitors/by-client/:clientId", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = await getCurrentUser(req);
    if (user?.role === "client" && user.clientId !== clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const comps = await storage.getCompetitorsByClient(clientId);
    res.json(comps);
  });

  app.post("/api/competitors", requireRole("admin", "designer"), async (req, res) => {
    try {
      const comp = await storage.createCompetitor(req.body);
      res.status(201).json(comp);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Erro ao criar concorrente" });
    }
  });

  app.put("/api/competitors/:id", requireRole("admin", "designer"), async (req, res) => {
    const comp = await storage.updateCompetitor(Number(req.params.id), req.body);
    res.json(comp);
  });

  app.delete("/api/competitors/:id", requireRole("admin", "designer"), async (req, res) => {
    await storage.deleteCompetitor(Number(req.params.id));
    res.status(204).send();
  });

  // === DASHBOARD INSIGHTS ===

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

  app.get("/api/briefings/public/:token", async (req, res) => {
    const { token } = req.params;
    const briefing = await storage.getBriefingByToken(token);
    if (!briefing) return res.status(404).json({ message: "Briefing não encontrado" });
    const client = await storage.getClient(briefing.clientId);
    res.json({ ...briefing, client: client ? { name: client.name } : null });
  });

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

  app.get("/api/onboarding/:clientId/custom-links", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const links = await storage.getClientCustomLinks(clientId);
    res.json(links);
  });

  app.post("/api/onboarding/:clientId/custom-links", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const { name, url, icon, position } = req.body;
    if (!name || !url) return res.status(400).json({ message: "Nome e URL são obrigatórios" });
    const link = await storage.createClientCustomLink({ clientId, name: String(name), url: String(url), icon: String(icon || "link"), position: Number(position) || 0 });
    res.status(201).json(link);
  });

  app.put("/api/custom-links/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
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

  app.delete("/api/custom-links/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
    await storage.deleteClientCustomLink(Number(req.params.id));
    res.json({ success: true });
  });

  const BRIEFING_UPLOADS_DIR = path.join(process.cwd(), "uploads", "briefings");
  if (!fs.existsSync(BRIEFING_UPLOADS_DIR)) fs.mkdirSync(BRIEFING_UPLOADS_DIR, { recursive: true });

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

  app.get("/api/uploads/briefing/:filename", (req, res) => {
    const filename = req.params.filename;
    const safeName = path.basename(filename);
    const filePath = path.join(BRIEFING_UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Arquivo não encontrado" });
    res.sendFile(filePath);
  });

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

  app.post("/api/briefings", requireRole("admin", "designer"), async (req, res) => {
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

  app.put("/api/briefings/:id", requireRole("admin", "designer"), async (req, res) => {
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

  app.delete("/api/briefings/:id", requireRole("admin", "designer"), async (req, res) => {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
    await storage.deleteBriefing(id);
    res.json({ success: true });
  });

  app.get("/api/briefing-templates", requireAuth, async (_req, res) => {
    const templates = await storage.getBriefingTemplates();
    res.json(templates);
  });

  app.get("/api/briefing-templates/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const template = await storage.getBriefingTemplate(id);
    if (!template) return res.status(404).json({ message: "Template não encontrado" });
    res.json(template);
  });

  app.post("/api/briefing-templates", requireRole("admin", "designer"), async (req, res) => {
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

  app.put("/api/briefing-templates/:id", requireRole("admin", "designer"), async (req, res) => {
    const id = Number(req.params.id);
    try {
      const template = await storage.updateBriefingTemplate(id, req.body);
      res.json(template);
    } catch (err) {
      console.error("Error updating briefing template:", err);
      res.status(500).json({ message: "Erro ao atualizar template" });
    }
  });

  app.delete("/api/briefing-templates/:id", requireRole("admin", "designer"), async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteBriefingTemplate(id);
    res.json({ success: true });
  });

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

  // === GOOGLE DRIVE ROUTES ===

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

  app.get("/api/kanban/:clientId/columns", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = await getCurrentUser(req);
    if (user?.role === "client" && user.clientId !== clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    let columns = await storage.getKanbanColumnsByClient(clientId);
    if (columns.length === 0) {
      for (let i = 0; i < DEFAULT_KANBAN_COLUMNS.length; i++) {
        await storage.createKanbanColumn({
          clientId,
          title: DEFAULT_KANBAN_COLUMNS[i],
          position: i,
          isDefault: true,
        });
      }
      columns = await storage.getKanbanColumnsByClient(clientId);
    } else {
      const existingTitles = columns.map(c => c.title);
      const maxPos = Math.max(...columns.map(c => c.position));
      let nextPos = maxPos + 1;
      let added = false;
      for (const requiredCol of PROTECTED_KANBAN_COLUMNS) {
        if (!existingTitles.includes(requiredCol)) {
          await storage.createKanbanColumn({
            clientId,
            title: requiredCol,
            position: nextPos++,
            isDefault: true,
          });
          added = true;
        }
      }
      if (added) {
        columns = await storage.getKanbanColumnsByClient(clientId);
      }
    }
    res.json(columns);
  });

  app.post("/api/kanban/:clientId/columns", requireRole("admin", "designer"), async (req, res) => {
    const clientId = Number(req.params.clientId);
    const { title, position } = req.body;
    const col = await storage.createKanbanColumn({ clientId, title, position: position ?? 999 });
    res.json(col);
  });

  app.put("/api/kanban/columns/:id", requireRole("admin", "designer"), async (req, res) => {
    const colId = Number(req.params.id);
    const existingCol = await storage.getKanbanColumn(colId);
    if (existingCol && PROTECTED_KANBAN_COLUMNS.includes(existingCol.title) && req.body.title && req.body.title !== existingCol.title) {
      return res.status(403).json({ message: `A coluna "${existingCol.title}" não pode ser renomeada` });
    }
    const col = await storage.updateKanbanColumn(colId, req.body);
    res.json(col);
  });

  app.delete("/api/kanban/columns/:id", requireRole("admin", "designer"), async (req, res) => {
    const colId = Number(req.params.id);
    const colToDelete = await storage.getKanbanColumn(colId);
    if (colToDelete && PROTECTED_KANBAN_COLUMNS.includes(colToDelete.title)) {
      return res.status(403).json({ message: `A coluna "${colToDelete.title}" é obrigatória e não pode ser excluída` });
    }
    await storage.deleteKanbanColumn(colId);
    res.json({ success: true });
  });

  app.put("/api/kanban/:clientId/columns/reorder", requireRole("admin", "designer"), async (req, res) => {
    const { columnIds } = req.body;
    await storage.reorderKanbanColumns(Number(req.params.clientId), columnIds);
    res.json({ success: true });
  });

  app.get("/api/kanban/:clientId/cards", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    const user = await getCurrentUser(req);
    if (user?.role === "client" && user.clientId !== clientId) {
      return res.status(403).json({ message: "Sem permissão" });
    }
    const cards = await storage.getKanbanCardsByClient(clientId);
    res.json(cards);
  });

  app.get("/api/client/approval-cards", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });

    let allCards: any[] = [];

    if (user.role === "client") {
      const clientId = user.clientId;
      if (!clientId) return res.status(400).json({ message: "Cliente não identificado" });
      allCards = await storage.getKanbanCardsByClient(clientId);
    } else if (user.role === "admin" || user.role === "designer") {
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

  app.get("/api/kanban/cards/:id", requireAuth, async (req, res) => {
    const card = await storage.getKanbanCard(Number(req.params.id));
    if (!card) return res.status(404).json({ message: "Cartão não encontrado" });
    res.json(card);
  });

  app.post("/api/kanban/cards", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    const card = await storage.createKanbanCard({ ...req.body, createdBy: user?.id });
    await storage.createKanbanActivity({
      cardId: card.id,
      userId: user?.id ?? null,
      action: "created",
      details: `Cartão "${card.title}" criado`,
    });
    res.json(card);
  });

  app.put("/api/kanban/cards/:id", requireAuth, async (req, res) => {
    const card = await storage.updateKanbanCard(Number(req.params.id), req.body);
    res.json(card);
  });

  app.delete("/api/kanban/cards/:id", requireRole("admin", "designer"), async (req, res) => {
    await storage.deleteKanbanCard(Number(req.params.id));
    res.json({ success: true });
  });

  app.put("/api/kanban/cards/:id/move", requireAuth, async (req, res) => {
    const { toColumnId, newPosition } = req.body;
    const cardId = Number(req.params.id);
    const user = await getCurrentUser(req);

    const oldCard = await storage.getKanbanCard(cardId);
    if (!oldCard) return res.status(404).json({ message: "Cartão não encontrado" });

    const oldColumnId = oldCard.columnId;

    if (toColumnId !== oldColumnId) {
      const columns = await storage.getKanbanColumnsByClient(oldCard.clientId);
      const fromCol = columns.find(c => c.id === oldColumnId);
      const toCol = columns.find(c => c.id === toColumnId);

      const allowedManualMoves: Record<string, string[]> = {
        "Aprovados": ["Agendados", "Postados"],
        "Agendados": ["Postados", "Finalizados"],
        "Postados": ["Finalizados"],
      };

      if (fromCol && PROTECTED_KANBAN_COLUMNS.includes(fromCol.title)) {
        const allowed = allowedManualMoves[fromCol.title] || [];
        if (toCol?.title !== "Em Aprovação" && !allowed.includes(toCol?.title || "")) {
          return res.status(403).json({ message: `Cartão na coluna "${fromCol.title}" só pode ser movido via ações de aprovação` });
        }
      }

      if (toCol && PROTECTED_KANBAN_COLUMNS.includes(toCol.title) && toCol.title !== "Em Aprovação") {
        const fromAllowed = allowedManualMoves[fromCol?.title || ""] || [];
        if (!fromAllowed.includes(toCol.title)) {
          return res.status(403).json({ message: `Use as ações de aprovação para mover para "${toCol.title}"` });
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

      if (fromCol && TIMED_COLUMNS.includes(fromCol.title)) {
        const openEntry = await storage.getOpenTimeEntry(cardId);
        if (openEntry) {
          await storage.stopTimeEntry(openEntry.id);
        }
      }
      if (toCol && TIMED_COLUMNS.includes(toCol.title) && user) {
        await storage.startTimeEntry(cardId, user.id);
      }
    }

    res.json(card);
  });

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

    const updated = await storage.updateKanbanCard(card.id, {
      columnId: targetCol.id,
      position: maxPos,
    });

    await storage.createKanbanActivity({
      cardId: card.id,
      userId: userId ?? null,
      action: "moved",
      fromColumnId: card.columnId,
      toColumnId: targetCol.id,
      details: `Movido de "${fromCol?.title}" para "${targetCol.title}"`,
    });

    if (fromCol && TIMED_COLUMNS.includes(fromCol.title)) {
      const openEntry = await storage.getOpenTimeEntry(card.id);
      if (openEntry) {
        await storage.stopTimeEntry(openEntry.id);
      }
    }
    if (targetCol && TIMED_COLUMNS.includes(targetCol.title) && userId) {
      await storage.startTimeEntry(card.id, userId);
    }

    return updated;
  }

  app.post("/api/kanban/cards/:id/send-approval", requireRole("admin", "designer"), async (req, res) => {
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
      type: "approval_sent",
      message: `"${card.title}" enviado para sua aprovação por ${user?.name || "Designer"}`,
      recipientRole: "client",
    });

    res.json(moved);
  });

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

    try {
      const client = await storage.getClient(card.clientId);
      const clientName = client?.name || "Cliente";

      let templateObj: Record<string, string> = {};
      try {
        if (card.templateData) templateObj = JSON.parse(card.templateData as string);
      } catch {}

      let platform: string[] = ["Instagram"];
      if (templateObj.platform) {
        if (templateObj.platform === "Todas") {
          platform = ["Instagram", "Facebook", "LinkedIn", "TikTok"];
        } else {
          platform = [templateObj.platform];
        }
      }

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
        status: "Rascunho",
        mediaUrl: mediaUrl,
        mediaUrls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : null,
        notes: postNotes,
      });
    } catch (err) {
      console.error("Error auto-creating post from approved card:", err);
    }

    res.json(moved);
  });

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

    res.json(moved);
  });

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

    res.json(moved);
  });

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
    });

    const moved = await moveCardToColumn(updated, "Em Aprovação", user?.id);

    await storage.createKanbanActivity({
      cardId,
      userId: user?.id ?? null,
      action: "undo_approval",
      details: `Decisão "${previousStatus}" desfeita, voltou para aprovação`,
    });

    res.json(moved);
  });

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

      const updated = await storage.updateKanbanCard(cardId, { attachments: JSON.stringify(attachments) });
      res.json(updated);
    } catch (err) {
      console.error("Error adding attachment:", err);
      res.status(500).json({ message: "Erro ao adicionar anexo" });
    }
  });

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

  app.get("/api/kanban/cards/:id/comments", requireAuth, async (req, res) => {
    const comments = await storage.getKanbanComments(Number(req.params.id));
    res.json(comments);
  });

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
      const recipientRole = user.role === "client" ? "admin" : "client";
      await storage.createNotification({
        clientId: card.clientId,
        type: "comment_added",
        message: `${user.name} comentou em "${card.title}": ${req.body.content.substring(0, 80)}${req.body.content.length > 80 ? "..." : ""}`,
        recipientRole,
      });
    }

    res.json(comment);
  });

  app.delete("/api/kanban/comments/:id", requireAuth, async (req, res) => {
    await storage.deleteKanbanComment(Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/kanban/cards/:id/activity", requireAuth, async (req, res) => {
    const activity = await storage.getKanbanActivity(Number(req.params.id));
    res.json(activity);
  });

  app.get("/api/kanban/cards/:id/time-entries", requireAuth, async (req, res) => {
    const entries = await storage.getKanbanTimeEntries(Number(req.params.id));
    res.json(entries);
  });

  app.get("/api/kanban/reports/designer", requireRole("admin", "designer"), async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const designers = allUsers.filter(u => u.role === "designer" || u.role === "admin");
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

  // === CLIENT ONBOARDING ROUTES ===

  async function checkOnboardingAccess(req: any, clientId: number): Promise<boolean> {
    const user = await getCurrentUser(req);
    if (!user) return false;
    if (user.role === "admin" || user.role === "designer") return true;
    if (user.role === "client" && user.clientId === clientId) return true;
    return false;
  }

  app.get("/api/onboarding/:clientId/products", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const products = await storage.getClientProducts(clientId);
    res.json(products);
  });
  app.post("/api/onboarding/:clientId/products", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const parsed = insertClientProductSchema.parse({ clientId, ...req.body });
    const product = await storage.createClientProduct(parsed);
    res.json(product);
  });
  app.put("/api/onboarding/products/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
    const product = await storage.updateClientProduct(Number(req.params.id), req.body);
    res.json(product);
  });
  app.delete("/api/onboarding/products/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
    await storage.deleteClientProduct(Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/onboarding/:clientId/services", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const services = await storage.getClientServices(clientId);
    res.json(services);
  });
  app.post("/api/onboarding/:clientId/services", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const parsed = insertClientServiceSchema.parse({ clientId, ...req.body });
    const service = await storage.createClientService(parsed);
    res.json(service);
  });
  app.put("/api/onboarding/services/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
    const service = await storage.updateClientService(Number(req.params.id), req.body);
    res.json(service);
  });
  app.delete("/api/onboarding/services/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
    await storage.deleteClientService(Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/onboarding/:clientId/credentials", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const creds = await storage.getClientCredentials(clientId);
    res.json(creds);
  });
  app.post("/api/onboarding/:clientId/credentials", requireAuth, async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const parsed = insertClientCredentialSchema.parse({ clientId, ...req.body });
    const cred = await storage.createClientCredential(parsed);
    res.json(cred);
  });
  app.put("/api/onboarding/credentials/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
    const cred = await storage.updateClientCredential(Number(req.params.id), req.body);
    res.json(cred);
  });
  app.delete("/api/onboarding/credentials/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
    await storage.deleteClientCredential(Number(req.params.id));
    res.json({ success: true });
  });

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
  app.post("/api/onboarding/:clientId/insights", requireAuth, async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Não autenticado" });
    const clientId = Number(req.params.clientId);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const message = z.string().min(1).parse(req.body.message);
    const insight = await storage.createClientInsight({ clientId, userId: user.id, message });
    const client = await storage.getClient(clientId);
    await storage.createNotification({
      clientId,
      type: "insight",
      message: `${user.name} postou um insight${client ? ` em ${client.name}` : ""}: "${message.substring(0, 60)}..."`,
      recipientRole: user.role === "client" ? "admin" : "client",
      isRead: false,
    });
    res.json({ ...insight, userName: user.name });
  });
  app.delete("/api/onboarding/insights/:id", requireAuth, requireRole(["admin", "designer"]), async (req, res) => {
    await storage.deleteClientInsight(Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/onboarding/:clientId/access", requireAuth, requireRole(["admin"]), async (req, res) => {
    const access = await storage.getOnboardingAccess(Number(req.params.clientId));
    res.json(access.map(a => a.userId));
  });
  app.put("/api/onboarding/:clientId/access", requireAuth, requireRole(["admin"]), async (req, res) => {
    const { userIds } = req.body;
    await storage.setOnboardingAccess(Number(req.params.clientId), userIds || []);
    res.json({ success: true, userIds });
  });

  app.put("/api/clients/:id/about", requireAuth, async (req, res) => {
    const clientId = Number(req.params.id);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const about = z.string().optional().parse(req.body.about);
    const updated = await storage.updateClient(clientId, { about: about || null });
    res.json(updated);
  });

  app.put("/api/clients/:id/tags", requireAuth, async (req, res) => {
    const clientId = Number(req.params.id);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const tags = z.array(z.string()).optional().parse(req.body.tags);
    const updated = await storage.updateClient(clientId, { tags: tags || null });
    res.json(updated);
  });

  app.put("/api/clients/:id/market-tags", requireAuth, async (req, res) => {
    const clientId = Number(req.params.id);
    if (!(await checkOnboardingAccess(req, clientId))) return res.status(403).json({ message: "Acesso negado" });
    const marketTags = z.array(z.string()).optional().parse(req.body.marketTags);
    const updated = await storage.updateClient(clientId, { marketTags: marketTags || null });
    res.json(updated);
  });

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

  app.put("/api/clients/:id/kanban-bg", requireRole("admin", "designer"), async (req, res) => {
    const clientId = Number(req.params.id);
    const { kanbanBgColor, kanbanBgImage } = req.body;
    const updated = await storage.updateClient(clientId, {
      kanbanBgColor: kanbanBgColor || null,
      kanbanBgImage: kanbanBgImage || null,
    });
    res.json(updated);
  });

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
      const coverThumbUrl = await generateThumbnail(file.buffer, coverThumbId, 800, 400);

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
        coverUrl: coverThumbUrl || thumbnailUrl || driveResult.downloadUrl,
      });

      res.json(updated);
    } catch (err) {
      console.error("Error uploading cover:", err);
      res.status(500).json({ message: "Erro ao enviar capa" });
    }
  });

  registerLocalStorageRoutes(app);

  // === WORKFLOW REPORTS ===
  app.get("/api/reports/workflow", requireAuth, requireRole("admin", "designer"), async (req, res) => {
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

  app.get("/api/reports/movements", requireAuth, requireRole("admin", "designer"), async (req, res) => {
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

      if (user.role === "client" && !targetClientId) {
        return res.status(400).json({ message: "clientId é obrigatório para clientes" });
      }

      const now = new Date();
      const targetMonth = month ? Number(month) - 1 : now.getMonth();
      const targetYear = year ? Number(year) : now.getFullYear();
      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      let clientIds: number[] = [];
      if (targetClientId) {
        clientIds = [targetClientId];
      } else if (user.role === "admin" || user.role === "designer") {
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

        const approvedCol = columns.find(c => c.title === "Aprovados");
        const pendingCol = columns.find(c => c.title === "Em Aprovação");
        const scheduledCol = columns.find(c => c.title === "Agendados");
        const postedCol = columns.find(c => c.title === "Postados");
        const finishedCol = columns.find(c => c.title === "Finalizados");
        const revisionCol = columns.find(c => c.title === "Revisão");
        const rejectedCol = columns.find(c => c.title === "Reprovados");

        const approvedCards = approvedCol ? cardsInPeriod.filter(c => c.columnId === approvedCol.id) : [];
        const pendingCards = pendingCol ? cardsInPeriod.filter(c => c.columnId === pendingCol.id) : [];
        const scheduledCards = scheduledCol ? cardsInPeriod.filter(c => c.columnId === scheduledCol.id) : [];
        const postedCards = postedCol ? cardsInPeriod.filter(c => c.columnId === postedCol.id) : [];
        const finishedCards = finishedCol ? cardsInPeriod.filter(c => c.columnId === finishedCol.id) : [];
        const revisionCards = revisionCol ? cardsInPeriod.filter(c => c.columnId === revisionCol.id) : [];
        const rejectedCards = rejectedCol ? cardsInPeriod.filter(c => c.columnId === rejectedCol.id) : [];

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
              if (p) {
                const normalized = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
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

  app.post("/api/clients/:clientId/brand-identity", requireAuth, requireRole("admin", "designer", "client"), upload.single("file"), async (req, res) => {
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

  app.delete("/api/brand-identity/:id", requireAuth, requireRole("admin", "designer"), async (req, res) => {
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

  await seedDatabase();

  return httpServer;
}

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
        status: "Rascunho",
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
