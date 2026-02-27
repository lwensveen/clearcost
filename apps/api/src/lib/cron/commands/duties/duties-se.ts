import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'se',
  dest: 'SE',
  mfnSourceKey: 'duties.se.official.mfn_excel',
  ftaSourceKey: 'duties.se.official.fta_excel',
  mfnEnvVar: 'SE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSeMfnOfficial = commands.mfn;
export const dutiesSeFtaOfficial = commands.fta;
export const dutiesSeAllOfficial = commands.all;
