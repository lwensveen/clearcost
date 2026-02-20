import { db, sourceRegistryTable } from '@clearcost/db';
import { eq } from 'drizzle-orm';

type SourceRegistryRow = {
  key: string;
  enabled: boolean;
  baseUrl: string | null;
  downloadUrlTemplate: string | null;
};

export async function getSourceRegistryByKey(sourceKey: string): Promise<SourceRegistryRow | null> {
  const rows = await db
    .select({
      key: sourceRegistryTable.key,
      enabled: sourceRegistryTable.enabled,
      baseUrl: sourceRegistryTable.baseUrl,
      downloadUrlTemplate: sourceRegistryTable.downloadUrlTemplate,
    })
    .from(sourceRegistryTable)
    .where(eq(sourceRegistryTable.key, sourceKey))
    .limit(1);

  return rows[0] ?? null;
}

function nonEmpty(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUndefinedTableError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === '42P01') return true;
  const message = String((err as { message?: unknown } | null)?.message ?? '');
  return message.toLowerCase().includes('relation "source_registry" does not exist');
}

export async function resolveSourceDownloadUrl(params: {
  sourceKey: string;
  fallbackUrl?: string;
}): Promise<string> {
  const fallback = nonEmpty(params.fallbackUrl);

  try {
    const source = await getSourceRegistryByKey(params.sourceKey);

    if (!source) {
      if (fallback) return fallback;
      throw new Error(
        `[source_registry] source '${params.sourceKey}' not found and no fallback URL provided`
      );
    }

    if (!source.enabled) {
      throw new Error(`[source_registry] source '${params.sourceKey}' is disabled`);
    }

    const preferred = nonEmpty(source.downloadUrlTemplate) ?? nonEmpty(source.baseUrl);
    if (preferred) return preferred;

    if (fallback) return fallback;
    throw new Error(
      `[source_registry] source '${params.sourceKey}' has no URL configured and no fallback URL provided`
    );
  } catch (err) {
    if (fallback && isUndefinedTableError(err)) {
      return fallback;
    }
    throw err;
  }
}
