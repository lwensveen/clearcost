import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gh',
  dest: 'GH',
  mfnSourceKey: 'duties.gh.official.mfn_excel',
  ftaSourceKey: 'duties.gh.official.fta_excel',
  mfnEnvVar: 'GH_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GH_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGhMfnOfficial = commands.mfn;
export const dutiesGhFtaOfficial = commands.fta;
export const dutiesGhAllOfficial = commands.all;
