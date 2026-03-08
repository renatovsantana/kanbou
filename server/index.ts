/**
 * @module server/index
 * Ponto de entrada principal do servidor Express.
 * Configura middlewares de segurança, parsing de body, sessão PostgreSQL,
 * logging de requisições e inicializa rotas e servimento estático.
 */

import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

/** Instância principal do Express */
const app = express();
/** Servidor HTTP wrapping o Express (necessário para WebSocket/SSE) */
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    /** Body cru da requisição, preservado antes do parsing JSON */
    rawBody: unknown;
  }
}

app.set("trust proxy", 1);

/**
 * Middleware de segurança: configura headers HTTP de proteção.
 * - X-Content-Type-Options: previne MIME sniffing
 * - X-Frame-Options: previne clickjacking
 * - X-XSS-Protection: proteção contra XSS
 * - Referrer-Policy: controla informações de referrer
 */
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.removeHeader("X-Powered-By");
  next();
});

/**
 * Middleware de parsing JSON com limite de 10MB.
 * Preserva o body cru em `req.rawBody` para uso posterior.
 */
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

/**
 * Configuração de sessão com armazenamento em PostgreSQL.
 * - Sessões persistem por 30 dias
 * - Cookie httpOnly e sameSite lax para segurança
 * - Modo secure configurável via FORCE_HTTPS
 */
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "shift-agency-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === "true",
      sameSite: "lax",
    },
  }),
);

/**
 * Registra uma mensagem no console com timestamp formatado.
 * @param message - Mensagem a ser logada
 * @param source - Origem do log (padrão: "express")
 */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Middleware de logging de requisições API.
 * Intercepta respostas JSON e registra método, path, status code,
 * duração e body da resposta para rotas /api.
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

/**
 * IIFE assíncrona que inicializa o servidor:
 * 1. Registra todas as rotas da API
 * 2. Configura handler global de erros
 * 3. Configura Vite (dev) ou arquivos estáticos (produção)
 * 4. Inicia o servidor na porta configurada
 */
(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
