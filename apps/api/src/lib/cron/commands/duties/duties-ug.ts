import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ug',
  dest: 'UG',
  mfnSourceKey: 'duties.ug.official.mfn_excel',
  ftaSourceKey: 'duties.ug.official.fta_excel',
  mfnEnvVar: 'UG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'UG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesUgMfnOfficial = commands.mfn;
export const dutiesUgFtaOfficial = commands.fta;
export const dutiesUgAllOfficial = commands.all;
