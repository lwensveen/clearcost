import { resolveSourceDownloadUrl } from '../../../lib/source-registry.js';

export const DEFAULT_OECD_VAT_XLSX_URL =
  'https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/consumption-tax-trends/vat-gst-rates-ctt-trends.xlsx';
export const DEFAULT_IMF_VAT_XLSX_URL =
  'https://www.imf.org/external/np/fad/tpaf/files/vat_substandard_rates.xlsx';

export type ResolveVatOfficialSourceUrlsOptions = {
  oecdXlsxUrl?: string;
  imfXlsxUrl?: string;
};

async function resolveWithFallback(sourceKey: string, fallbackUrl: string): Promise<string> {
  try {
    return await resolveSourceDownloadUrl({ sourceKey, fallbackUrl });
  } catch {
    return fallbackUrl;
  }
}

export async function resolveVatOfficialSourceUrls(
  opts: ResolveVatOfficialSourceUrlsOptions = {}
): Promise<{
  oecdXlsxUrl: string;
  imfXlsxUrl: string;
}> {
  if (opts.oecdXlsxUrl !== undefined || opts.imfXlsxUrl !== undefined) {
    return {
      oecdXlsxUrl: opts.oecdXlsxUrl ?? DEFAULT_OECD_VAT_XLSX_URL,
      imfXlsxUrl: opts.imfXlsxUrl ?? DEFAULT_IMF_VAT_XLSX_URL,
    };
  }

  const [oecdXlsxUrl, imfXlsxUrl] = await Promise.all([
    resolveWithFallback('vat.oecd_imf.standard', DEFAULT_OECD_VAT_XLSX_URL),
    resolveWithFallback('vat.imf.standard', DEFAULT_IMF_VAT_XLSX_URL),
  ]);

  return { oecdXlsxUrl, imfXlsxUrl };
}
