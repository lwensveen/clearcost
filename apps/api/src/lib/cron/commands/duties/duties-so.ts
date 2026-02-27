import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'so',
  dest: 'SO',
  mfnSourceKey: 'duties.so.official.mfn_excel',
  ftaSourceKey: 'duties.so.official.fta_excel',
  mfnEnvVar: 'SO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSoMfnOfficial = commands.mfn;
export const dutiesSoFtaOfficial = commands.fta;
export const dutiesSoAllOfficial = commands.all;
