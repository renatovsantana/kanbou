import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { requireAuth } from "./auth";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const PUBLIC_DIR = path.join(UPLOADS_DIR, "public");
const PRIVATE_DIR = path.join(UPLOADS_DIR, "private");

if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(PRIVATE_DIR)) fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function getExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return "." + parts[parts.length - 1].toLowerCase();
}

export function registerLocalStorageRoutes(app: Express): void {
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

  app.get("/uploads/private/:fileName", requireAuth, (req: Request, res: Response) => {
    const fileName = String(req.params.fileName);
    const filePath = path.join(PRIVATE_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.sendFile(filePath);
  });

  app.get("/uploads/public/:fileName", (req: Request, res: Response) => {
    const fileName = String(req.params.fileName);
    const filePath = path.join(PUBLIC_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.sendFile(filePath);
  });

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
