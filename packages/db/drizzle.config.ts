import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schemas/index.js',
  out: './src/drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
});
