
/**
 * @module server/db
 * Configuração da conexão com o banco de dados PostgreSQL usando Drizzle ORM.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Pool de conexões PostgreSQL configurado com a URL do banco de dados.
 * Usado para gerenciar conexões reutilizáveis ao banco.
 */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Instância do Drizzle ORM configurada com o pool de conexões e o schema da aplicação.
 * Ponto central de acesso ao banco de dados para queries tipadas.
 */
export const db = drizzle(pool, { schema });
