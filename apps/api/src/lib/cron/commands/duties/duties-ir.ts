import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ir',
  dest: 'IR',
  mfnSourceKey: 'duties.ir.official.mfn_excel',
  ftaSourceKey: 'duties.ir.official.fta_excel',
  mfnEnvVar: 'IR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesIrMfnOfficial = commands.mfn;
export const dutiesIrFtaOfficial = commands.fta;
export const dutiesIrAllOfficial = commands.all;
