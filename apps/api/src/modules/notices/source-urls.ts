import { resolveSourceDownloadUrl } from '../../lib/source-registry.js';

export type CnNoticeAuthority = 'MOF' | 'GACC' | 'MOFCOM';

type CnNoticeSourceConfig = {
  sourceKey: string;
  envKey: 'CN_MOF_NOTICE_URLS' | 'CN_GACC_NOTICE_URLS' | 'CN_MOFCOM_NOTICE_URLS';
};

const CN_NOTICE_SOURCE_CONFIG: Record<CnNoticeAuthority, CnNoticeSourceConfig> = {
  MOF: { sourceKey: 'notices.cn.mof.list', envKey: 'CN_MOF_NOTICE_URLS' },
  GACC: { sourceKey: 'notices.cn.gacc.list', envKey: 'CN_GACC_NOTICE_URLS' },
  MOFCOM: { sourceKey: 'notices.cn.mofcom.list', envKey: 'CN_MOFCOM_NOTICE_URLS' },
};

function nonEmpty(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function dedupe(urls: string[]): string[] {
  return Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
}

function parseCsvEnvUrls(raw: string | undefined): string[] {
  return dedupe(
    (raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

async function resolveWithOptionalFallback(
  sourceKey: string,
  fallbackUrl?: string
): Promise<string | undefined> {
  const fallback = nonEmpty(fallbackUrl);
  try {
    const resolved = await resolveSourceDownloadUrl({
      sourceKey,
      ...(fallback ? { fallbackUrl: fallback } : {}),
    });
    return nonEmpty(resolved);
  } catch {
    return fallback;
  }
}

export function isCnNoticeAuthority(value: string): value is CnNoticeAuthority {
  return value === 'MOF' || value === 'GACC' || value === 'MOFCOM';
}

export function getCnNoticeSourceConfig(authority: CnNoticeAuthority): CnNoticeSourceConfig {
  return CN_NOTICE_SOURCE_CONFIG[authority];
}

export async function resolveCnNoticeSeedUrls(params: {
  authority: CnNoticeAuthority;
  explicitUrls?: string[];
  env?: NodeJS.ProcessEnv;
}): Promise<{
  sourceKey: string;
  sourceUrl?: string;
  urls: string[];
}> {
  const config = getCnNoticeSourceConfig(params.authority);
  const explicitUrls = dedupe(params.explicitUrls ?? []);

  if (explicitUrls.length) {
    return {
      sourceKey: config.sourceKey,
      sourceUrl: explicitUrls[0],
      urls: explicitUrls,
    };
  }

  const env = params.env ?? process.env;
  const envUrls = parseCsvEnvUrls(env[config.envKey]);
  const sourceUrl = await resolveWithOptionalFallback(config.sourceKey, envUrls[0]);
  const urls = dedupe([...(sourceUrl ? [sourceUrl] : []), ...envUrls]);

  return { sourceKey: config.sourceKey, sourceUrl, urls };
}
