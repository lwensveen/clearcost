import { resolveSourceDownloadUrl } from '../../../../../lib/source-registry.js';

type UrlOverrides = {
  goodsUrl?: string;
  descUrl?: string;
};

async function resolveOptionalUrl(
  override: string | undefined,
  sourceKey: string,
  fallbackEnv: string | undefined
): Promise<string> {
  if (override !== undefined) return override;
  try {
    return await resolveSourceDownloadUrl({
      sourceKey,
      fallbackUrl: fallbackEnv ?? '',
    });
  } catch {
    return '';
  }
}

export async function resolveEuTaricHsSourceUrls(
  overrides: UrlOverrides = {}
): Promise<{ goodsUrl: string; descUrl: string }> {
  const [goodsUrl, descUrl] = await Promise.all([
    resolveOptionalUrl(overrides.goodsUrl, 'hs.eu.taric.goods', process.env.EU_TARIC_GOODS_URL),
    resolveOptionalUrl(
      overrides.descUrl,
      'hs.eu.taric.goods_description',
      process.env.EU_TARIC_GOODS_DESC_URL
    ),
  ]);

  return { goodsUrl, descUrl };
}
