import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'qa',
  dest: 'QA',
  mfnSourceKey: 'duties.qa.official.mfn_excel',
  ftaSourceKey: 'duties.qa.official.fta_excel',
  mfnEnvVar: 'QA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'QA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesQaMfnOfficial = commands.mfn;
export const dutiesQaFtaOfficial = commands.fta;
export const dutiesQaAllOfficial = commands.all;
