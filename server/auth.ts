import type { Request, Response, NextFunction } from "express";
import type { Session } from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function getSession(req: Request): any {
  return (req as any).session;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session?.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  next();
}

export function requireRole(...roles: (string | string[])[]) {
  const flatRoles = roles.flat();
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = getSession(req);
    if (!session?.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const user = await storage.getUser(session.userId);
    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }
    if (!flatRoles.includes(user.role)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    (req as any).user = user;
    next();
  };
}

export async function getCurrentUser(req: Request): Promise<User | undefined> {
  const session = getSession(req);
  if (!session?.userId) return undefined;
  return storage.getUser(session.userId);
}
