import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ht',
  dest: 'HT',
  mfnSourceKey: 'duties.ht.official.mfn_excel',
  ftaSourceKey: 'duties.ht.official.fta_excel',
  mfnEnvVar: 'HT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'HT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesHtMfnOfficial = commands.mfn;
export const dutiesHtFtaOfficial = commands.fta;
export const dutiesHtAllOfficial = commands.all;
