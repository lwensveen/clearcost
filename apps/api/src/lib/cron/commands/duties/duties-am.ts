import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'am',
  dest: 'AM',
  mfnSourceKey: 'duties.am.official.mfn_excel',
  ftaSourceKey: 'duties.am.official.fta_excel',
  mfnEnvVar: 'AM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAmMfnOfficial = commands.mfn;
export const dutiesAmFtaOfficial = commands.fta;
export const dutiesAmAllOfficial = commands.all;
