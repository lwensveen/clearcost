import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tm',
  dest: 'TM',
  mfnSourceKey: 'duties.tm.official.mfn_excel',
  ftaSourceKey: 'duties.tm.official.fta_excel',
  mfnEnvVar: 'TM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTmMfnOfficial = commands.mfn;
export const dutiesTmFtaOfficial = commands.fta;
export const dutiesTmAllOfficial = commands.all;
