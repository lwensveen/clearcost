import { resolveSourceDownloadUrl } from '../../../source-registry.js';

export const DUTIES_CN_MFN_PDF_SOURCE_KEY = 'duties.cn.taxbook.pdf';

function nonEmpty(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('file://');
}

export async function resolveCnMfnPdfInput(params?: {
  overrideUrl?: string;
  overrideFile?: string;
  positional?: string;
}): Promise<{ sourceKey: string; urlOrPath?: string; sourceUrl?: string }> {
  const override =
    nonEmpty(params?.overrideUrl) ?? nonEmpty(params?.overrideFile) ?? nonEmpty(params?.positional);
  if (override) {
    return {
      sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY,
      urlOrPath: override,
      sourceUrl: isUrlLike(override) ? override : undefined,
    };
  }

  try {
    const resolved = await resolveSourceDownloadUrl({ sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY });
    const urlOrPath = nonEmpty(resolved);
    return {
      sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY,
      urlOrPath,
      sourceUrl: urlOrPath && isUrlLike(urlOrPath) ? urlOrPath : undefined,
    };
  } catch {
    return { sourceKey: DUTIES_CN_MFN_PDF_SOURCE_KEY };
  }
}
