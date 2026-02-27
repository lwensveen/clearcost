import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pr',
  dest: 'PR',
  mfnSourceKey: 'duties.pr.official.mfn_excel',
  ftaSourceKey: 'duties.pr.official.fta_excel',
  mfnEnvVar: 'PR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPrMfnOfficial = commands.mfn;
export const dutiesPrFtaOfficial = commands.fta;
export const dutiesPrAllOfficial = commands.all;
