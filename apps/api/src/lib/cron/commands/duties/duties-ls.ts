import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ls',
  dest: 'LS',
  mfnSourceKey: 'duties.ls.official.mfn_excel',
  ftaSourceKey: 'duties.ls.official.fta_excel',
  mfnEnvVar: 'LS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLsMfnOfficial = commands.mfn;
export const dutiesLsFtaOfficial = commands.fta;
export const dutiesLsAllOfficial = commands.all;
