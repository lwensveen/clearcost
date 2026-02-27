import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'to',
  dest: 'TO',
  mfnSourceKey: 'duties.to.official.mfn_excel',
  ftaSourceKey: 'duties.to.official.fta_excel',
  mfnEnvVar: 'TO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesToMfnOfficial = commands.mfn;
export const dutiesToFtaOfficial = commands.fta;
export const dutiesToAllOfficial = commands.all;
