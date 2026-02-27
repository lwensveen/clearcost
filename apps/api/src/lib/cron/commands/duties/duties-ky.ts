import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ky',
  dest: 'KY',
  mfnSourceKey: 'duties.ky.official.mfn_excel',
  ftaSourceKey: 'duties.ky.official.fta_excel',
  mfnEnvVar: 'KY_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KY_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKyMfnOfficial = commands.mfn;
export const dutiesKyFtaOfficial = commands.fta;
export const dutiesKyAllOfficial = commands.all;
