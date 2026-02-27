import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'uz',
  dest: 'UZ',
  mfnSourceKey: 'duties.uz.official.mfn_excel',
  ftaSourceKey: 'duties.uz.official.fta_excel',
  mfnEnvVar: 'UZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'UZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesUzMfnOfficial = commands.mfn;
export const dutiesUzFtaOfficial = commands.fta;
export const dutiesUzAllOfficial = commands.all;
