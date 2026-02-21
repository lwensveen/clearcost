import { resolveSourceDownloadUrl } from '../../source-registry.js';

export const PROGRAMS_MEMBERS_SOURCE_KEY = 'duties.us.trade_programs.members_csv';

function nonEmpty(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function resolveProgramsMembersCsvUrl(
  overrideUrl?: string
): Promise<string | undefined> {
  const override = nonEmpty(overrideUrl);
  if (override) return override;

  try {
    const resolved = await resolveSourceDownloadUrl({
      sourceKey: PROGRAMS_MEMBERS_SOURCE_KEY,
    });
    return nonEmpty(resolved);
  } catch {
    return undefined;
  }
}
