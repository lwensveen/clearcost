import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'as',
  dest: 'AS',
  mfnSourceKey: 'duties.as.official.mfn_excel',
  ftaSourceKey: 'duties.as.official.fta_excel',
  mfnEnvVar: 'AS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAsMfnOfficial = commands.mfn;
export const dutiesAsFtaOfficial = commands.fta;
export const dutiesAsAllOfficial = commands.all;
