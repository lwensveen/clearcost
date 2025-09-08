import crypto from 'node:crypto';
import { db, importsTable } from '@clearcost/db';
import { eq, sql } from 'drizzle-orm';

export function sha256Hex(buf: string | Uint8Array) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export type ImportRun = typeof importsTable.$inferSelect;

export type ImportSource =
  | 'AHTN'
  | 'APHIS'
  | 'API'
  | 'BASELINE'
  | 'CN_TAXBOOK'
  | 'CSV'
  | 'ECB'
  | 'FDA'
  | 'FILE'
  | 'GROK'
  | 'ID_BTKI'
  | 'IMF'
  | 'JP_CUSTOMS'
  | 'LLM_CROSSCHECK'
  | 'MANIFEST'
  | 'MANUAL'
  | 'MY_GAZETTE'
  | 'OECD'
  | 'OECD/IMF'
  | 'OFFICIAL'
  | 'OPENAI'
  | 'PH_TARIFF_COMMISSION'
  | 'SEED'
  | 'TARIC'
  | 'TRADE_GOV'
  | 'UK_OPS'
  | 'UK_TT'
  | 'US'
  | 'USITC_HTS'
  | 'WITS'
  | 'ZONOS';

export async function heartBeatImportRun(id: string) {
  await db
    .update(importsTable)
    .set({ updatedAt: sql`now()` })
    .where(eq(importsTable.id, id));
}

export async function startImportRun(params: {
  importSource: ImportSource;
  job: string;
  version?: string;
  sourceUrl?: string;
  params?: Record<string, unknown>;
}): Promise<ImportRun> {
  const rows = await db
    .insert(importsTable)
    .values({
      importSource: params.importSource,
      job: params.job,
      version: params.version ?? null,
      sourceUrl: params.sourceUrl ?? null,
      params: params.params ? JSON.stringify(params.params) : null,
      importStatus: 'running',
    })
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error('startImportRun: insert returned no rows');
  }
  return row as ImportRun;
}

export async function finishImportRun(
  id: string,
  patch: {
    importStatus: 'succeeded' | 'failed';
    inserted?: number;
    updated?: number;
    fileHash?: string | null;
    fileBytes?: number | null;
    error?: string | null;
  }
): Promise<ImportRun> {
  const rows = await db
    .update(importsTable)
    .set({
      importStatus: patch.importStatus,
      inserted: patch.inserted ?? undefined,
      updated: patch.updated ?? undefined,
      fileHash: patch.fileHash ?? undefined,
      fileBytes: patch.fileBytes ?? undefined,
      error: patch.error ?? undefined,
      finishedAt: new Date(),
    })
    .where(eq(importsTable.id, id))
    .returning();

  const row = rows[0];
  if (!row) {
    throw new Error(`finishImportRun: update returned no rows for id ${id}`);
  }
  return row as ImportRun;
}
