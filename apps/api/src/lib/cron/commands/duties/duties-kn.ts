import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'kn',
  dest: 'KN',
  mfnSourceKey: 'duties.kn.official.mfn_excel',
  ftaSourceKey: 'duties.kn.official.fta_excel',
  mfnEnvVar: 'KN_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KN_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKnMfnOfficial = commands.mfn;
export const dutiesKnFtaOfficial = commands.fta;
export const dutiesKnAllOfficial = commands.all;
