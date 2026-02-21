const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

export function isWitsImportsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthyFlag(env.ENABLE_WITS_IMPORTS) || isTruthyFlag(env.ENABLE_WITS_BACKFILL);
}

export function witsImportsDisabledMessage(): string {
  return 'WITS imports are disabled. Set ENABLE_WITS_IMPORTS=true (or ENABLE_WITS_BACKFILL=true for weekly backfills).';
}

export function assertWitsImportsEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (!isWitsImportsEnabled(env)) {
    throw new Error(witsImportsDisabledMessage());
  }
}
