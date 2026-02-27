import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'kz',
  dest: 'KZ',
  mfnSourceKey: 'duties.kz.official.mfn_excel',
  ftaSourceKey: 'duties.kz.official.fta_excel',
  mfnEnvVar: 'KZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKzMfnOfficial = commands.mfn;
export const dutiesKzFtaOfficial = commands.fta;
export const dutiesKzAllOfficial = commands.all;
