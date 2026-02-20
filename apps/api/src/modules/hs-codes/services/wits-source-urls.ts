import { resolveSourceDownloadUrl } from '../../../lib/source-registry.js';

export const DEFAULT_WITS_HS_SDMX_DATA_BASE =
  'https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_Tariff_TRAINS';
export const DEFAULT_WITS_HS_DSD_URL =
  'https://wits.worldbank.org/API/V1/SDMX/V21/rest/datastructure/WBG_WITS/TARIFF_TRAINS/';
export const DEFAULT_WITS_HS_PRODUCTS_ALL_URL =
  'https://wits.worldbank.org/API/V1/wits/datasource/trn/product/all';

export type ResolveWitsHsSourceUrlsOptions = {
  dataBaseUrl?: string;
  dsdUrl?: string;
  productsAllUrl?: string;
};

async function resolveOptionalUrl(
  override: string | undefined,
  sourceKey: string,
  fallbackUrl: string
): Promise<string> {
  if (override !== undefined) return override;
  try {
    return await resolveSourceDownloadUrl({ sourceKey, fallbackUrl });
  } catch {
    return fallbackUrl;
  }
}

export async function resolveWitsHsSourceUrls(
  opts: ResolveWitsHsSourceUrlsOptions = {}
): Promise<{ dataBaseUrl: string; dsdUrl: string; productsAllUrl: string }> {
  const dataBaseUrl =
    opts.dataBaseUrl ??
    (await resolveSourceDownloadUrl({
      sourceKey: 'hs.wits.sdmx.data_base',
      fallbackUrl: process.env.WITS_HS_SDMX_DATA_BASE ?? DEFAULT_WITS_HS_SDMX_DATA_BASE,
    }));

  const dsdUrl = await resolveOptionalUrl(
    opts.dsdUrl,
    'hs.wits.sdmx.datastructure',
    process.env.WITS_HS_DSD_URL ?? DEFAULT_WITS_HS_DSD_URL
  );

  const productsAllUrl = await resolveOptionalUrl(
    opts.productsAllUrl,
    'hs.wits.products.all',
    process.env.WITS_HS_PRODUCTS_ALL_URL ?? DEFAULT_WITS_HS_PRODUCTS_ALL_URL
  );

  return { dataBaseUrl, dsdUrl, productsAllUrl };
}
