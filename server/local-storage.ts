/**
 * @module server/local-storage
 * Sistema de armazenamento local de arquivos.
 * Gerencia upload, download e servimento de arquivos armazenados no sistema de arquivos local,
 * com suporte a diretórios públicos e privados.
 */

import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { requireAuth } from "./auth";

/** Diretório raiz para uploads */
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
/** Diretório para arquivos públicos (acessíveis sem autenticação) */
const PUBLIC_DIR = path.join(UPLOADS_DIR, "public");
/** Diretório para arquivos privados (requerem autenticação) */
const PRIVATE_DIR = path.join(UPLOADS_DIR, "private");

if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(PRIVATE_DIR)) fs.mkdirSync(PRIVATE_DIR, { recursive: true });

/**
 * Middleware multer configurado para armazenamento em memória com limite de 50MB por arquivo.
 */
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * Extrai a extensão de um nome de arquivo.
 * @param filename - Nome do arquivo (ex: "imagem.png")
 * @returns Extensão com ponto (ex: ".png") ou string vazia se não houver extensão
 */
function getExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return "." + parts[parts.length - 1].toLowerCase();
}

/**
 * Registra todas as rotas de upload e download de arquivos no Express.
 * Inclui:
 * - POST /api/uploads/file - Upload direto de arquivo via multipart (autenticado)
 * - POST /api/uploads/request-url - Gera URL para upload direto (autenticado)
 * - PUT /api/uploads/direct/:fileName - Endpoint para upload direto via PUT
 * - GET /uploads/private/:fileName - Download de arquivo privado (autenticado)
 * - GET /uploads/public/:fileName - Download de arquivo público
 * - GET /objects/*objectPath - Rota genérica para servir objetos por path
 * @param app - Instância do Express onde as rotas serão registradas
 */
export function registerLocalStorageRoutes(app: Express): void {
  /**
   * POST /api/uploads/file
   * Upload de arquivo via multipart form-data. Requer autenticação.
   * Salva o arquivo no diretório privado com nome UUID.
   */
  app.post("/api/uploads/file", requireAuth, uploadMiddleware.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const ext = getExtension(req.file.originalname);
      const fileId = randomUUID();
      const fileName = `${fileId}${ext}`;
      const filePath = path.join(PRIVATE_DIR, fileName);

      fs.writeFileSync(filePath, req.file.buffer);

      const objectPath = `/uploads/private/${fileName}`;

      res.json({
        objectPath,
        metadata: {
          name: req.file.originalname,
          size: req.file.size,
          contentType: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  /**
   * POST /api/uploads/request-url
   * Gera uma URL para upload direto via PUT. Requer autenticação.
   * Retorna a URL de upload e o caminho do objeto resultante.
   */
  app.post("/api/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }

      const ext = getExtension(name);
      const fileId = randomUUID();
      const fileName = `${fileId}${ext}`;
      const objectPath = `/uploads/private/${fileName}`;

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
      const uploadURL = `${protocol}://${host}/api/uploads/direct/${fileName}`;

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * PUT /api/uploads/direct/:fileName
   * Recebe o conteúdo binário do arquivo via body e salva no diretório privado.
   * Usado em conjunto com a URL gerada por /api/uploads/request-url.
   */
  app.put("/api/uploads/direct/:fileName", async (req: Request, res: Response) => {
    try {
      const fileName = String(req.params.fileName);
      const filePath = path.join(PRIVATE_DIR, fileName);

      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(filePath, buffer);
        res.status(200).json({ ok: true });
      });
    } catch (error) {
      console.error("Error in direct upload:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  /**
   * GET /uploads/private/:fileName
   * Serve arquivo do diretório privado. Requer autenticação.
   */
  app.get("/uploads/private/:fileName", requireAuth, (req: Request, res: Response) => {
    const fileName = String(req.params.fileName);
    const filePath = path.join(PRIVATE_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.sendFile(filePath);
  });

  /**
   * GET /uploads/public/:fileName
   * Serve arquivo do diretório público. Não requer autenticação.
   */
  app.get("/uploads/public/:fileName", (req: Request, res: Response) => {
    const fileName = String(req.params.fileName);
    const filePath = path.join(PUBLIC_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.sendFile(filePath);
  });

  /**
   * GET /objects/*objectPath
   * Rota genérica para servir objetos por caminho.
   * Mapeia paths de objetos para os diretórios locais correspondentes.
   */
  app.get("/objects/*objectPath", (req: Request, res: Response) => {
    const objectPath = req.path;
    let mappedPath: string;

    if (objectPath.startsWith("/uploads/")) {
      mappedPath = path.join(UPLOADS_DIR, objectPath.replace("/uploads/", ""));
    } else if (objectPath.startsWith("/objects/uploads/")) {
      mappedPath = path.join(UPLOADS_DIR, objectPath.replace("/objects/uploads/", "private/"));
    } else {
      mappedPath = path.join(UPLOADS_DIR, "private", path.basename(objectPath));
    }

    if (!fs.existsSync(mappedPath)) {
      return res.status(404).json({ error: "Object not found" });
    }

    res.sendFile(mappedPath);
  });
}
