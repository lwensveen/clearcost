import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ru',
  dest: 'RU',
  mfnSourceKey: 'duties.ru.official.mfn_excel',
  ftaSourceKey: 'duties.ru.official.fta_excel',
  mfnEnvVar: 'RU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'RU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesRuMfnOfficial = commands.mfn;
export const dutiesRuFtaOfficial = commands.fta;
export const dutiesRuAllOfficial = commands.all;
