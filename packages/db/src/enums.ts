import { pgEnum } from 'drizzle-orm/pg-core';

/** VAT / indirect tax */
export const vatBaseEnum = pgEnum('vat_base', ['CIF', 'CIF_PLUS_DUTY', 'FOB']);

export const deMinimisKind = ['DUTY', 'VAT'] as const;
export type DeMinimisKind = (typeof deMinimisKind)[number];

export const deMinimisBasis = ['INTRINSIC', 'CIF'] as const;
export type DeMinimisBasis = (typeof deMinimisBasis)[number];

export const vatRateKindEnum = pgEnum('vat_rate_kind', [
  'REDUCED',
  'STANDARD',
  'SUPER_REDUCED',
  'ZERO',
]);

/** Freight */
export const freightModeEnum = pgEnum('freight_mode', ['air', 'sea', 'express']);
export const freightUnitEnum = pgEnum('freight_unit', ['kg', 'm3']);

/** Duties */
export const dutySourceEnum = pgEnum('duty_source', [
  'official', // TARIC, USITC, etc.
  'wits', // World Bank WITS
  'vendor', // third-party provider
  'manual', // operator-entered
  'llm', // model-generated helper / cross-check
]);

export const dutyRuleEnum = pgEnum('duty_rule', [
  'mfn',
  'fta',
  'anti_dumping',
  'safeguard',
  'quota',
  'provisional',
]);

/** Duty components (for non-ad-valorem and mixed) */
export const dutyComponentTypeEnum = pgEnum('duty_component_type', [
  'advalorem', // percentage of customs value
  'specific', // amount per unit (e.g., CNY/kg)
  'minimum', // floor (e.g., min EUR/100kg)
  'maximum', // cap  (e.g., max EUR/100kg)
  'other', // catch-all/exotic
]);

/** Surcharges / fees */
export const surchargeCodeEnum = pgEnum('surcharge_code', [
  'ANTIDUMPING',
  'AQI_AIRCRAFT',
  'AQI_BARGE',
  'AQI_RAILCAR',
  'AQI_TRUCK_SINGLE',
  'AQI_TRUCK_TRANSPONDER',
  'AQI_VESSEL',
  'COUNTERVAILING',
  'CUSTOMS_PROCESSING',
  'DISBURSEMENT',
  'EXCISE',
  'FDA_FSMA_REINSPECTION_HOURLY_DOM',
  'FDA_FSMA_REINSPECTION_HOURLY_FOR',
  'FDA_VQIP_APPLICATION_FEE',
  'FDA_VQIP_USER_FEE_ANNUAL',
  'FUEL',
  'HANDLING',
  'HMF',
  'MPF',
  'OTHER',
  'REMOTE',
  'SECURITY',
  'TRADE_REMEDY_232',
  'TRADE_REMEDY_301',
]);

export const surchargeRateTypeEnum = pgEnum('surcharge_rate_type', [
  'ad_valorem', // fraction (0–1)
  'fixed', // fixed currency
  'per_unit', // currency per unit
]);

export const surchargeApplyLevelEnum = pgEnum('surcharge_apply_level', [
  'arrival',
  'entry',
  'line',
  'program',
  'shipment',
]);

export const surchargeValueBasisEnum = pgEnum('surcharge_value_basis', [
  'cif',
  'customs',
  'duty',
  'entered',
  'fob',
  'other',
]);

/** Misc */
export const transportModeEnum = pgEnum('transport_mode', [
  'ALL',
  'AIR',
  'OCEAN',
  'TRUCK',
  'RAIL',
  'BARGE',
]);

export const importSourceEnum = pgEnum('import_source', [
  'AHTN',
  'APHIS',
  'API',
  'BASELINE',
  'CN_NOTICES',
  'CN_TAXBOOK',
  'CSV',
  'ECB',
  'FDA',
  'FILE',
  'GROK',
  'ID_BTKI',
  'IMF',
  'JP_CUSTOMS',
  'LLM_CROSSCHECK',
  'MANIFEST',
  'MANUAL',
  'MY_GAZETTE',
  'NOTICES',
  'OECD',
  'OECD/IMF',
  'OFFICIAL',
  'OPENAI',
  'PH_TARIFF_COMMISSION',
  'SEED',
  'TARIC',
  'TRADE_GOV',
  'UK_OPS',
  'UK_TT',
  'US',
  'USITC_HTS',
  'WITS',
  'ZONOS',
]);

export const importStatusEnum = pgEnum('import_status', ['running', 'succeeded', 'failed']);

export const resourceTypeEnum = pgEnum('resource_type', [
  'de_minimis',
  'duty_rate',
  'duty_rate_component',
  'freight_card',
  'hs_code',
  'hs_code_alias',
  'surcharge',
  'vat_rule',
]);

export const shippingModeEnum = pgEnum('shipping_mode', ['air', 'sea']);
export const pricingModeEnum = pgEnum('pricing_mode', ['cards', 'fixed']);
export const incotermEnum = pgEnum('incoterm', ['DAP', 'DDP']);

export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member']);

export const NOTICE_TYPE_VALUES = [
  'provisional_rate',
  'trq',
  'retaliatory',
  'suspension',
  'fta_schedule',
  'general',
  'other',
] as const;

export const NOTICE_STATUS_VALUES = ['new', 'fetched', 'parsed', 'ignored', 'error'] as const;

export const noticeTypeEnum = pgEnum('notice_type', NOTICE_TYPE_VALUES);
export const noticeStatusEnum = pgEnum('notice_status', NOTICE_STATUS_VALUES);
