import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'co',
  dest: 'CO',
  mfnSourceKey: 'duties.co.official.mfn_excel',
  ftaSourceKey: 'duties.co.official.fta_excel',
  mfnEnvVar: 'CO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCoMfnOfficial = commands.mfn;
export const dutiesCoFtaOfficial = commands.fta;
export const dutiesCoAllOfficial = commands.all;
