import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tz',
  dest: 'TZ',
  mfnSourceKey: 'duties.tz.official.mfn_excel',
  ftaSourceKey: 'duties.tz.official.fta_excel',
  mfnEnvVar: 'TZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTzMfnOfficial = commands.mfn;
export const dutiesTzFtaOfficial = commands.fta;
export const dutiesTzAllOfficial = commands.all;
