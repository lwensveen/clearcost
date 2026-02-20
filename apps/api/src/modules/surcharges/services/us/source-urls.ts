import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export const DEFAULT_US_SURCHARGE_SOURCE_URLS = {
  aphisFees: 'https://www.aphis.usda.gov/aphis/resources/fees',
  aphisFy25: 'https://www.aphis.usda.gov/aphis/newsroom/stakeholder-info/aqi-fee-2025',
  fdaVqip: 'https://www.fda.gov/food/voluntary-qualified-importer-program-vqip/vqip-fees',
  federalRegisterSearchBase: 'https://www.federalregister.gov/search',
  federalRegisterDocumentsApi: 'https://www.federalregister.gov/api/v1/documents.json',
} as const;

async function resolveWithFallback(sourceKey: string, fallbackUrl: string): Promise<string> {
  try {
    return await resolveSourceDownloadUrl({ sourceKey, fallbackUrl });
  } catch {
    return fallbackUrl;
  }
}

export async function resolveUsSurchargeSourceUrls(): Promise<{
  aphisFeesUrl: string;
  aphisFy25Url: string;
  fdaVqipUrl: string;
  federalRegisterSearchBaseUrl: string;
  federalRegisterDocumentsApiUrl: string;
}> {
  const [
    aphisFeesUrl,
    aphisFy25Url,
    fdaVqipUrl,
    federalRegisterSearchBaseUrl,
    federalRegisterDocumentsApiUrl,
  ] = await Promise.all([
    resolveWithFallback('surcharges.us.aphis.aqi_fees', DEFAULT_US_SURCHARGE_SOURCE_URLS.aphisFees),
    resolveWithFallback('surcharges.us.aphis.aqi_fy25', DEFAULT_US_SURCHARGE_SOURCE_URLS.aphisFy25),
    resolveWithFallback('surcharges.us.fda.vqip_fees', DEFAULT_US_SURCHARGE_SOURCE_URLS.fdaVqip),
    resolveWithFallback(
      'surcharges.us.federal_register.search',
      DEFAULT_US_SURCHARGE_SOURCE_URLS.federalRegisterSearchBase
    ),
    resolveWithFallback(
      'surcharges.us.federal_register.documents_api',
      DEFAULT_US_SURCHARGE_SOURCE_URLS.federalRegisterDocumentsApi
    ),
  ]);

  return {
    aphisFeesUrl,
    aphisFy25Url,
    fdaVqipUrl,
    federalRegisterSearchBaseUrl,
    federalRegisterDocumentsApiUrl,
  };
}
