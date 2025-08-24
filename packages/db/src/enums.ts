import { pgEnum } from 'drizzle-orm/pg-core';

export const vatBaseEnum = pgEnum('vat_base', ['CIF', 'CIF_PLUS_DUTY']);

export const deMinimisAppliesEnum = pgEnum('de_minimis_applies', ['DUTY', 'DUTY_VAT', 'NONE']);

export const freightModeEnum = pgEnum('freight_mode', ['air', 'sea']);

export const freightUnitEnum = pgEnum('freight_unit', ['kg', 'm3']);

export const dutyRuleEnum = pgEnum('duty_rule', ['mfn', 'fta', 'other']);

export const surchargeCodeEnum = pgEnum('surcharge_code', [
  'CUSTOMS_PROCESSING',
  'DISBURSEMENT',
  'EXCISE',
  'HANDLING',
]);
