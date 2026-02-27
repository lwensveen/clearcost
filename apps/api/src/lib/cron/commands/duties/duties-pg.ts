import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pg',
  dest: 'PG',
  mfnSourceKey: 'duties.pg.official.mfn_excel',
  ftaSourceKey: 'duties.pg.official.fta_excel',
  mfnEnvVar: 'PG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPgMfnOfficial = commands.mfn;
export const dutiesPgFtaOfficial = commands.fta;
export const dutiesPgAllOfficial = commands.all;
