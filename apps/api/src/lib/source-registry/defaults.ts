type SourceDataset =
  | 'fx'
  | 'vat'
  | 'duties'
  | 'surcharges'
  | 'hs'
  | 'de_minimis'
  | 'freight'
  | 'notices';
type SourceType = 'api' | 'csv' | 'xlsx' | 'xml' | 'json' | 'html' | 'pdf' | 'llm' | 'manual';
type SourceScheduleHint = 'hourly' | 'daily' | 'weekly' | 'manual';
type SourceExpectedFormat = 'json' | 'csv' | 'xlsx' | 'xml' | 'html' | 'pdf' | 'other' | null;
type SourceAuthStrategy = 'none' | 'api_key' | 'oauth';

export type SourceRegistryDefaultEntry = {
  key: string;
  dataset: SourceDataset;
  sourceType: SourceType;
  scheduleHint: SourceScheduleHint;
  expectedFormat: SourceExpectedFormat;
  authStrategy: SourceAuthStrategy;
  parserVersion: string;
  notes: string | null;
};

export const OFFICIAL_FX_REQUIRED_SOURCE_KEYS = ['fx.ecb.daily'] as const;
export const OFFICIAL_VAT_REQUIRED_SOURCE_KEYS = [
  'vat.oecd_imf.standard',
  'vat.imf.standard',
] as const;
export const OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS = [
  'de-minimis.official.us.section321',
  'de-minimis.official.eu.reg_1186_2009',
  'de-minimis.official.gb.vat_overseas_goods',
  'de-minimis.official.ca.lvs_vat',
  'de-minimis.official.ca.lvs_duty',
] as const;
export const OFFICIAL_HS_REQUIRED_SOURCE_KEYS = [
  'hs.asean.ahtn.csv',
  'hs.eu.taric.goods',
  'hs.eu.taric.goods_description',
  'hs.uk.tariff.api_base',
  'hs.us.usitc.base',
  'hs.us.usitc.csv',
  'hs.us.usitc.json',
] as const;
export const OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS = [
  'notices.cn.mof.list',
  'notices.cn.gacc.list',
  'notices.cn.mofcom.list',
] as const;
export const OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS = [
  'duties.uk.tariff.api_base',
  'surcharges.eu.taric.measure',
  'surcharges.eu.taric.component',
  'surcharges.eu.taric.geo_description',
  'surcharges.eu.taric.duty_expression',
  'surcharges.us.aphis.aqi_fees',
  'surcharges.us.aphis.aqi_fy25',
  'surcharges.us.fda.vqip_fees',
  'surcharges.us.federal_register.search',
  'surcharges.us.federal_register.documents_api',
  'surcharges.us.statute.hmf',
  'surcharges.us.statute.mpf',
] as const;
export const OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS = [
  'duties.eu.taric.daily',
  'duties.eu.taric.mfn',
  'duties.eu.taric.preferential',
  'duties.eu.taric.measure',
  'duties.eu.taric.component',
  'duties.eu.taric.duty_expression',
  'duties.eu.taric.geo_description',
  'duties.bn.official.mfn_excel',
  'duties.bn.official.fta_excel',
  'duties.uk.tariff.api_base',
  'duties.us.usitc.base',
  'duties.us.usitc.csv',
  'duties.us.trade_programs.members_csv',
  'duties.jp.customs.tariff_index',
  'duties.cn.taxbook.pdf',
  'duties.cn.official.fta_excel',
  'duties.id.btki.xlsx',
  'duties.id.btki.portal',
  'duties.id.official.fta_excel',
  'duties.kh.official.mfn_excel',
  'duties.kh.official.fta_excel',
  'duties.la.official.mfn_excel',
  'duties.la.official.fta_excel',
  'duties.mm.official.mfn_excel',
  'duties.mm.official.fta_excel',
  'duties.my.gazette.mfn_pdf',
  'duties.my.official.mfn_excel',
  'duties.my.official.fta_excel',
  'duties.ph.tariff_commission.xlsx',
  'duties.ph.official.fta_excel',
  'duties.sg.official.mfn_excel',
  'duties.sg.official.fta_excel',
  'duties.th.official.mfn_excel',
  'duties.th.official.fta_excel',
  'duties.vn.official.mfn_excel',
  'duties.vn.official.fta_excel',
] as const;
export const OPTIONAL_FALLBACK_SOURCE_KEYS = [
  'duties.wits.sdmx.base',
  'hs.wits.sdmx.data_base',
  'de-minimis.trade_gov.api',
  'de-minimis.zonos.docs',
] as const;
const OPTIONAL_FALLBACK_SOURCE_KEY_SET = new Set<string>(OPTIONAL_FALLBACK_SOURCE_KEYS);

function uniqueSourceKeys(keys: ReadonlyArray<string>): string[] {
  return [...new Set(keys)];
}

export const ALL_REQUIRED_SOURCE_KEYS = uniqueSourceKeys([
  ...OFFICIAL_DUTY_REQUIRED_SOURCE_KEYS,
  ...OFFICIAL_FX_REQUIRED_SOURCE_KEYS,
  ...OFFICIAL_VAT_REQUIRED_SOURCE_KEYS,
  ...OFFICIAL_DE_MINIMIS_REQUIRED_SOURCE_KEYS,
  ...OFFICIAL_HS_REQUIRED_SOURCE_KEYS,
  ...OFFICIAL_NOTICES_REQUIRED_SOURCE_KEYS,
  ...OFFICIAL_SURCHARGES_REQUIRED_SOURCE_KEYS,
  ...OPTIONAL_FALLBACK_SOURCE_KEYS,
]);

function inferDataset(key: string): SourceDataset {
  if (key.startsWith('fx.')) return 'fx';
  if (key.startsWith('vat.')) return 'vat';
  if (key.startsWith('duties.')) return 'duties';
  if (key.startsWith('surcharges.')) return 'surcharges';
  if (key.startsWith('hs.')) return 'hs';
  if (key.startsWith('de-minimis.')) return 'de_minimis';
  if (key.startsWith('notices.')) return 'notices';
  return 'freight';
}

function inferSourceType(key: string): SourceType {
  const token = key.toLowerCase();
  if (token.endsWith('.csv') || token.includes('_csv')) return 'csv';
  if (token.endsWith('.xlsx') || token.includes('_excel')) return 'xlsx';
  if (token.endsWith('.pdf') || token.includes('_pdf')) return 'pdf';
  if (token.endsWith('.json')) return 'json';
  if (token.includes('.api') || token.endsWith('.base') || token.endsWith('.portal')) return 'api';
  if (token.includes('.taric.')) return 'xml';
  if (token.includes('.list') || token.includes('.docs') || token.includes('.statute'))
    return 'html';
  return 'manual';
}

function inferExpectedFormat(sourceType: SourceType): SourceExpectedFormat {
  switch (sourceType) {
    case 'csv':
      return 'csv';
    case 'xlsx':
      return 'xlsx';
    case 'xml':
      return 'xml';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'pdf':
      return 'pdf';
    case 'api':
      return 'other';
    default:
      return null;
  }
}

function inferScheduleHint(key: string): SourceScheduleHint {
  if (OPTIONAL_FALLBACK_SOURCE_KEY_SET.has(key)) return 'manual';
  if (key.startsWith('notices.')) return 'daily';
  return 'daily';
}

export const SOURCE_REGISTRY_DEFAULT_ENTRIES: ReadonlyArray<SourceRegistryDefaultEntry> =
  ALL_REQUIRED_SOURCE_KEYS.map((key) => {
    const sourceType = inferSourceType(key);
    return {
      key,
      dataset: inferDataset(key),
      sourceType,
      scheduleHint: inferScheduleHint(key),
      expectedFormat: inferExpectedFormat(sourceType),
      authStrategy: 'none',
      parserVersion: 'v1',
      notes: null,
    };
  });
