import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'aq',
  dest: 'AQ',
  mfnSourceKey: 'duties.aq.official.mfn_excel',
  ftaSourceKey: 'duties.aq.official.fta_excel',
  mfnEnvVar: 'AQ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AQ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAqMfnOfficial = commands.mfn;
export const dutiesAqFtaOfficial = commands.fta;
export const dutiesAqAllOfficial = commands.all;
