import { db, sourceRegistryTable } from '@clearcost/db';
import { inArray } from 'drizzle-orm';
import type { Command } from '../../runtime.js';
import { flagBool, flagCSV, parseFlags } from '../../utils.js';
import { DUTY_COUNTRY_SCAFFOLD_COMMANDS } from './duties-country-scaffold-commands.js';
import { DUTY_COUNTRY_SCAFFOLD_SLUGS } from './duties-country-scaffold-data.js';

type SourceRegistryUrlRow = {
  key: string;
  enabled: boolean;
  baseUrl: string | null;
  downloadUrlTemplate: string | null;
};

export type ScaffoldCountryReadiness = {
  slug: string;
  commandKey: string;
  mfnSourceKey: string;
  ftaSourceKey: string;
  mfnReady: boolean;
  ftaReady: boolean;
  runnable: boolean;
  reasons: string[];
};

function normalizeOptional(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mfnSourceKey(slug: string): string {
  return `duties.${slug}.official.mfn_excel`;
}

function ftaSourceKey(slug: string): string {
  return `duties.${slug}.official.fta_excel`;
}

function commandKey(slug: string): string {
  return `import:duties:${slug}-all-official`;
}

function envVarName(slug: string, kind: 'mfn' | 'fta'): string {
  return `${slug.toUpperCase()}_${kind.toUpperCase()}_OFFICIAL_EXCEL_URL`;
}

function hasConfiguredRegistryUrl(row: SourceRegistryUrlRow | undefined): boolean {
  if (!row || !row.enabled) return false;
  return Boolean(normalizeOptional(row.downloadUrlTemplate) ?? normalizeOptional(row.baseUrl));
}

export function parseRequestedScaffoldSlugs(tokens: ReadonlyArray<string>): string[] {
  if (tokens.length === 0) return [...DUTY_COUNTRY_SCAFFOLD_SLUGS];

  const normalized = [
    ...new Set(tokens.map((token) => token.trim().toLowerCase()).filter(Boolean)),
  ];
  const known = new Set(DUTY_COUNTRY_SCAFFOLD_SLUGS);
  const unknown = normalized.filter(
    (slug) => !known.has(slug as (typeof DUTY_COUNTRY_SCAFFOLD_SLUGS)[number])
  );

  if (unknown.length > 0) {
    throw new Error(
      `Unknown duty scaffold country slug(s): ${unknown.join(', ')} (supported: ${DUTY_COUNTRY_SCAFFOLD_SLUGS.join(', ')})`
    );
  }

  return normalized;
}

export function evaluateScaffoldCountryReadiness(params: {
  slugs: ReadonlyArray<string>;
  rows: ReadonlyArray<SourceRegistryUrlRow>;
  env: NodeJS.ProcessEnv;
}): ScaffoldCountryReadiness[] {
  const byKey = new Map(params.rows.map((row) => [row.key, row]));

  return params.slugs.map((slug) => {
    const mfnKey = mfnSourceKey(slug);
    const ftaKey = ftaSourceKey(slug);
    const mfnRow = byKey.get(mfnKey);
    const ftaRow = byKey.get(ftaKey);

    const mfnReady =
      hasConfiguredRegistryUrl(mfnRow) ||
      Boolean(normalizeOptional(params.env[envVarName(slug, 'mfn')]));
    const ftaReady =
      hasConfiguredRegistryUrl(ftaRow) ||
      Boolean(normalizeOptional(params.env[envVarName(slug, 'fta')]));

    const reasons: string[] = [];
    if (!mfnReady) reasons.push(`${mfnKey} has no enabled URL (source_registry or env fallback)`);
    if (!ftaReady) reasons.push(`${ftaKey} has no enabled URL (source_registry or env fallback)`);

    return {
      slug,
      commandKey: commandKey(slug),
      mfnSourceKey: mfnKey,
      ftaSourceKey: ftaKey,
      mfnReady,
      ftaReady,
      runnable: mfnReady && ftaReady,
      reasons,
    };
  });
}

function isUndefinedTableError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === '42P01') return true;
  const message = String((err as { message?: unknown } | null)?.message ?? '');
  return message.toLowerCase().includes('relation "source_registry" does not exist');
}

function unique(values: ReadonlyArray<string>): string[] {
  return [...new Set(values)];
}

async function loadSourceRegistryRows(
  keys: ReadonlyArray<string>
): Promise<SourceRegistryUrlRow[]> {
  if (keys.length === 0) return [];

  try {
    return await db
      .select({
        key: sourceRegistryTable.key,
        enabled: sourceRegistryTable.enabled,
        baseUrl: sourceRegistryTable.baseUrl,
        downloadUrlTemplate: sourceRegistryTable.downloadUrlTemplate,
      })
      .from(sourceRegistryTable)
      .where(inArray(sourceRegistryTable.key, [...keys]));
  } catch (err) {
    if (isUndefinedTableError(err)) return [];
    throw err;
  }
}

type FailedCountryRun = {
  slug: string;
  commandKey: string;
  error: string;
};

export const dutiesCountryScaffoldEnabledAllOfficial: Command = async (args) => {
  const flags = parseFlags(args);
  const strict = flagBool(flags, 'strict');
  const requestedSlugs = parseRequestedScaffoldSlugs(flagCSV(flags, 'countries'));
  const passthroughArgs = args.filter(
    (arg) => !arg.startsWith('--countries=') && arg !== '--strict' && !arg.startsWith('--strict=')
  );

  const sourceRows = await loadSourceRegistryRows(
    unique(requestedSlugs.flatMap((slug) => [mfnSourceKey(slug), ftaSourceKey(slug)]))
  );
  const readiness = evaluateScaffoldCountryReadiness({
    slugs: requestedSlugs,
    rows: sourceRows,
    env: process.env,
  });

  const runnable = readiness.filter((country) => country.runnable);
  const skipped = readiness.filter((country) => !country.runnable);
  const failed: FailedCountryRun[] = [];
  let executed = 0;

  for (const country of runnable) {
    const command = DUTY_COUNTRY_SCAFFOLD_COMMANDS[country.commandKey];
    if (!command) {
      failed.push({
        slug: country.slug,
        commandKey: country.commandKey,
        error: 'command_not_registered',
      });
      continue;
    }

    try {
      await command(passthroughArgs);
      executed += 1;
    } catch (err) {
      failed.push({
        slug: country.slug,
        commandKey: country.commandKey,
        error: String((err as { message?: unknown } | null)?.message ?? err),
      });
    }
  }

  const summary = {
    ok: failed.length === 0 && (!strict || skipped.length === 0),
    requestedCountries: requestedSlugs.length,
    runnableCountries: runnable.length,
    executedCountries: executed,
    skippedCountries: skipped.map((country) => ({
      slug: country.slug,
      reasons: country.reasons,
    })),
    failedCountries: failed,
  };
  console.log(summary);

  if (failed.length > 0) {
    throw new Error(
      `country scaffold duties import failed for ${failed.length} country(ies): ${failed
        .map((item) => item.slug)
        .join(', ')}`
    );
  }

  if (strict && skipped.length > 0) {
    throw new Error(
      `country scaffold duties import skipped ${skipped.length} country(ies) in strict mode: ${skipped
        .map((item) => item.slug)
        .join(', ')}`
    );
  }
};
