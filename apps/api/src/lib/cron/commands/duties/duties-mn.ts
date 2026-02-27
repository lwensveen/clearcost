import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mn',
  dest: 'MN',
  mfnSourceKey: 'duties.mn.official.mfn_excel',
  ftaSourceKey: 'duties.mn.official.fta_excel',
  mfnEnvVar: 'MN_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MN_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMnMfnOfficial = commands.mfn;
export const dutiesMnFtaOfficial = commands.fta;
export const dutiesMnAllOfficial = commands.all;
