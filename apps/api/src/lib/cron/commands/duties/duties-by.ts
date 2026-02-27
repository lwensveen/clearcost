import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'by',
  dest: 'BY',
  mfnSourceKey: 'duties.by.official.mfn_excel',
  ftaSourceKey: 'duties.by.official.fta_excel',
  mfnEnvVar: 'BY_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BY_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesByMfnOfficial = commands.mfn;
export const dutiesByFtaOfficial = commands.fta;
export const dutiesByAllOfficial = commands.all;
