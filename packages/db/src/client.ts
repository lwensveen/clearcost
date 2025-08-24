import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { schema } from './schemas/index.js';

const connectionString = process.env.DATABASE_URL!;

export const sql = postgres(connectionString, {
  prepare: false,
  ssl: connectionString.includes('sslmode=require') ? 'require' : undefined,
});

export const db = drizzle(sql, { schema });
