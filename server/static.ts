/**
 * @module server/static
 * Configuração para servir arquivos estáticos em modo de produção.
 * Serve o build do frontend e redireciona rotas não encontradas para o index.html (SPA fallback).
 */

import express, { type Express } from "express";
import fs from "fs";
import path from "path";

/**
 * Configura o Express para servir os arquivos estáticos do build de produção do frontend.
 * Inclui fallback para index.html para suportar roteamento client-side (SPA).
 * @param app - Instância do Express onde os middlewares estáticos serão registrados
 * @throws Error se o diretório de build (`public`) não existir
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
