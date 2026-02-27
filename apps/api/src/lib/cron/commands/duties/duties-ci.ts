import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ci',
  dest: 'CI',
  mfnSourceKey: 'duties.ci.official.mfn_excel',
  ftaSourceKey: 'duties.ci.official.fta_excel',
  mfnEnvVar: 'CI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCiMfnOfficial = commands.mfn;
export const dutiesCiFtaOfficial = commands.fta;
export const dutiesCiAllOfficial = commands.all;
