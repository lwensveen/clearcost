import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pm',
  dest: 'PM',
  mfnSourceKey: 'duties.pm.official.mfn_excel',
  ftaSourceKey: 'duties.pm.official.fta_excel',
  mfnEnvVar: 'PM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPmMfnOfficial = commands.mfn;
export const dutiesPmFtaOfficial = commands.fta;
export const dutiesPmAllOfficial = commands.all;
