import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tg',
  dest: 'TG',
  mfnSourceKey: 'duties.tg.official.mfn_excel',
  ftaSourceKey: 'duties.tg.official.fta_excel',
  mfnEnvVar: 'TG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTgMfnOfficial = commands.mfn;
export const dutiesTgFtaOfficial = commands.fta;
export const dutiesTgAllOfficial = commands.all;
