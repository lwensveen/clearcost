import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tn',
  dest: 'TN',
  mfnSourceKey: 'duties.tn.official.mfn_excel',
  ftaSourceKey: 'duties.tn.official.fta_excel',
  mfnEnvVar: 'TN_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TN_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTnMfnOfficial = commands.mfn;
export const dutiesTnFtaOfficial = commands.fta;
export const dutiesTnAllOfficial = commands.all;
