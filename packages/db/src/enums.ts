import { pgEnum } from 'drizzle-orm/pg-core';

export const vatBaseEnum = pgEnum('vat_base', ['CIF', 'CIF_PLUS_DUTY', 'FOB']);

export const deMinimisAppliesEnum = pgEnum('de_minimis_applies', ['DUTY', 'DUTY_VAT', 'NONE']);

export const freightModeEnum = pgEnum('freight_mode', ['air', 'sea']);

export const freightUnitEnum = pgEnum('freight_unit', ['kg', 'm3']);

export const dutyRuleEnum = pgEnum('duty_rule', ['mfn', 'fta', 'anti_dumping', 'safeguard']);

export const surchargeCodeEnum = pgEnum('surcharge_code', [
  'CUSTOMS_PROCESSING',
  'DISBURSEMENT',
  'EXCISE',
  'FUEL',
  'HANDLING',
  'OTHER',
  'REMOTE',
  'SECURITY',
]);
