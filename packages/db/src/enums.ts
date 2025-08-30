import { pgEnum } from 'drizzle-orm/pg-core';

export const vatBaseEnum = pgEnum('vat_base', ['CIF', 'CIF_PLUS_DUTY', 'FOB']);

export const deMinimisKind = ['DUTY', 'VAT'] as const;
export type DeMinimisKind = (typeof deMinimisKind)[number];

export const deMinimisBasis = ['INTRINSIC', 'CIF'] as const;
export type DeMinimisBasis = (typeof deMinimisBasis)[number];

export const vatRateKindEnum = pgEnum('vat_rate_kind', [
  'STANDARD',
  'REDUCED',
  'SUPER_REDUCED',
  'ZERO',
]);

export const freightModeEnum = pgEnum('freight_mode', ['air', 'sea', 'express']);

export const freightUnitEnum = pgEnum('freight_unit', ['kg', 'm3']);

export const dutyRuleEnum = pgEnum('duty_rule', ['mfn', 'fta', 'anti_dumping', 'safeguard']);

export const surchargeCodeEnum = pgEnum('surcharge_code', [
  'ANTIDUMPING',
  'COUNTERVAILING',
  'CUSTOMS_PROCESSING',
  'DISBURSEMENT',
  'EXCISE',
  'FUEL',
  'HANDLING',
  'HMF',
  'MPF',
  'OTHER',
  'REMOTE',
  'SECURITY',
  'TRADE_REMEDY_232',
  'TRADE_REMEDY_301',
  'AQI_VESSEL',
  'AQI_AIRCRAFT',
  'AQI_RAILCAR',
  'AQI_TRUCK_SINGLE',
  'AQI_TRUCK_TRANSPONDER',
  'AQI_BARGE',
  'FDA_VQIP_USER_FEE_ANNUAL',
  'FDA_VQIP_APPLICATION_FEE',
  'FDA_FSMA_REINSPECTION_HOURLY_DOM',
  'FDA_FSMA_REINSPECTION_HOURLY_FOR',
]);

export const surchargeRateTypeEnum = pgEnum('surcharge_rate_type', [
  'ad_valorem', // percent (0–1) of a value basis
  'fixed', // fixed currency amount
  'per_unit', // amount per unit (unit_code/unit_amt)
]);

export const surchargeApplyLevelEnum = pgEnum('surcharge_apply_level', [
  'entry', // whole entry / shipment arrival
  'line', // per HS line
  'shipment', // transportation-level charge
  'program', // program enrollment/annual/etc.
  'arrival',
]);

export const surchargeValueBasisEnum = pgEnum('surcharge_value_basis', [
  'customs', // customs value (transaction value)
  'fob',
  'cif',
  'entered', // entered value (if you prefer this naming)
  'duty', // duty amount (rare, but some fees piggyback on duty)
  'other',
]);

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
  'CSV',
  'ECB',
  'FDA',
  'FILE',
  'IMF',
  'MANIFEST',
  'MANUAL',
  'OECD',
  'OECD/IMF',
  'OFFICIAL',
  'SEED',
  'TARIC',
  'UK_OPS',
  'UK_TT',
  'US',
  'USITC_HTS',
  'WITS',
  'ZONOS',
]);

export const importStatusEnum = pgEnum('import_status', ['running', 'succeeded', 'failed']);

export const resourceTypeEnum = pgEnum('resource_type', [
  'duty_rate',
  'freight_card',
  'hs_code',
  'hs_code_alias',
  'surcharge',
  'vat_rule',
]);

export const shippingModeEnum = pgEnum('shipping_mode', ['air', 'sea']);
export const pricingModeEnum = pgEnum('pricing_mode', ['cards', 'fixed']);
export const incotermEnum = pgEnum('incoterm', ['DAP', 'DDP']); // optional on quotes
