import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'uy',
  dest: 'UY',
  mfnSourceKey: 'duties.uy.official.mfn_excel',
  ftaSourceKey: 'duties.uy.official.fta_excel',
  mfnEnvVar: 'UY_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'UY_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesUyMfnOfficial = commands.mfn;
export const dutiesUyFtaOfficial = commands.fta;
export const dutiesUyAllOfficial = commands.all;
