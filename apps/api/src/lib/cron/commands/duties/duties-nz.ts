import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'nz',
  dest: 'NZ',
  mfnSourceKey: 'duties.nz.official.mfn_excel',
  ftaSourceKey: 'duties.nz.official.fta_excel',
  mfnEnvVar: 'NZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNzMfnOfficial = commands.mfn;
export const dutiesNzFtaOfficial = commands.fta;
export const dutiesNzAllOfficial = commands.all;
