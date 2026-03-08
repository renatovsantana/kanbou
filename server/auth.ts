/**
 * @module server/auth
 * Módulo de autenticação e autorização.
 * Fornece funções para hash/verificação de senhas, middleware de autenticação
 * e controle de acesso baseado em roles (papéis).
 */

import type { Request, Response, NextFunction } from "express";
import type { Session } from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User } from "@shared/schema";

/**
 * Gera um hash bcrypt para a senha fornecida.
 * @param password - Senha em texto puro para ser hasheada
 * @returns Hash bcrypt da senha com salt de 10 rounds
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verifica se uma senha em texto puro corresponde ao hash armazenado.
 * @param password - Senha em texto puro para verificação
 * @param hash - Hash bcrypt armazenado para comparação
 * @returns `true` se a senha corresponde ao hash, `false` caso contrário
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Extrai o objeto de sessão do request Express.
 * @param req - Objeto Request do Express
 * @returns Objeto de sessão com dados do usuário autenticado
 */
function getSession(req: Request): any {
  return (req as any).session;
}

/**
 * Middleware que exige autenticação para acessar a rota.
 * Retorna 401 se o usuário não estiver autenticado (sem userId na sessão).
 * @param req - Objeto Request do Express
 * @param res - Objeto Response do Express
 * @param next - Função next do Express para continuar o fluxo
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session?.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  next();
}

/**
 * Factory de middleware que exige autenticação E uma role específica.
 * Verifica se o usuário está autenticado e se possui uma das roles permitidas.
 * Anexa o objeto `user` ao request se autorizado.
 * @param roles - Lista de roles permitidas (ex: "admin", "designer", "client")
 * @returns Middleware Express que valida autenticação e autorização por role
 */
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

/**
 * Recupera o usuário autenticado a partir da sessão do request.
 * @param req - Objeto Request do Express
 * @returns O objeto User do usuário autenticado, ou `undefined` se não autenticado
 */
export async function getCurrentUser(req: Request): Promise<User | undefined> {
  const session = getSession(req);
  if (!session?.userId) return undefined;
  return storage.getUser(session.userId);
}
