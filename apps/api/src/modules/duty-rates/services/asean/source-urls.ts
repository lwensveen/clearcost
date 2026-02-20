import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export type ResolveAseanDutySourceUrlOptions = {
  sourceKey: string;
  fallbackUrl?: string;
};

function normalizeFallbackUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export async function resolveAseanDutySourceUrl(
  options: ResolveAseanDutySourceUrlOptions
): Promise<string> {
  const fallbackUrl = normalizeFallbackUrl(options.fallbackUrl);
  if (fallbackUrl) {
    return resolveSourceDownloadUrl({ sourceKey: options.sourceKey, fallbackUrl });
  }
  return resolveSourceDownloadUrl({ sourceKey: options.sourceKey });
}
