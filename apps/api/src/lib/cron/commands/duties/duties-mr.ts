import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mr',
  dest: 'MR',
  mfnSourceKey: 'duties.mr.official.mfn_excel',
  ftaSourceKey: 'duties.mr.official.fta_excel',
  mfnEnvVar: 'MR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMrMfnOfficial = commands.mfn;
export const dutiesMrFtaOfficial = commands.fta;
export const dutiesMrAllOfficial = commands.all;
