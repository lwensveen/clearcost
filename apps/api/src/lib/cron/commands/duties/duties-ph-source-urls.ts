import { resolveSourceDownloadUrl } from '../../../source-registry.js';

export const DUTIES_PH_MFN_SOURCE_KEY = 'duties.ph.tariff_commission.xlsx';

function nonEmpty(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function resolvePhMfnExcelUrl(params?: {
  overrideUrl?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ sourceKey: string; sourceUrl?: string }> {
  const override = nonEmpty(params?.overrideUrl);
  if (override) return { sourceKey: DUTIES_PH_MFN_SOURCE_KEY, sourceUrl: override };

  const env = params?.env ?? process.env;
  const fallbackUrl = nonEmpty(env.PH_TARIFF_EXCEL_URL);

  try {
    const resolved = await resolveSourceDownloadUrl({
      sourceKey: DUTIES_PH_MFN_SOURCE_KEY,
      ...(fallbackUrl ? { fallbackUrl } : {}),
    });
    return {
      sourceKey: DUTIES_PH_MFN_SOURCE_KEY,
      sourceUrl: nonEmpty(resolved) ?? fallbackUrl,
    };
  } catch {
    return { sourceKey: DUTIES_PH_MFN_SOURCE_KEY, sourceUrl: fallbackUrl };
  }
}
