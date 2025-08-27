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
]);

export const importSourceEnum = pgEnum('import_source', [
  'AHTN',
  'BASELINE',
  'ECB',
  'IMF',
  'MANUAL',
  'OECD',
  'OECD/IMF',
  'OFFICIAL',
  'TARIC',
  'UK_OPS',
  'UK_TT',
  'US',
  'USITC_HTS',
  'WITS',
  'ZONOS',
  'file',
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
