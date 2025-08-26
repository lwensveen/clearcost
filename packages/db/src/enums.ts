import { pgEnum } from 'drizzle-orm/pg-core';

export const vatBaseEnum = pgEnum('vat_base', ['CIF', 'CIF_PLUS_DUTY', 'FOB']);

export const deMinimisAppliesEnum = pgEnum('de_minimis_applies', [
  'NONE', // no exemption
  'DUTY', // exempts duty only
  'VAT', // exempts VAT only
  'DUTY_VAT', // exempts both
]);

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
  'WITS',
  'TARIC',
  'USITC_HTS',
  'OECD',
  'IMF',
  'MANUAL',
  'AHTN',
  'UK_OPS',
  'ECB',
  'UK_TT',
  'US',
  'file',
  'OECD/IMF',
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
