import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'hr',
  dest: 'HR',
  mfnSourceKey: 'duties.hr.official.mfn_excel',
  ftaSourceKey: 'duties.hr.official.fta_excel',
  mfnEnvVar: 'HR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'HR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesHrMfnOfficial = commands.mfn;
export const dutiesHrFtaOfficial = commands.fta;
export const dutiesHrAllOfficial = commands.all;
