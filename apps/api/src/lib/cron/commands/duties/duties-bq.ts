import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bq',
  dest: 'BQ',
  mfnSourceKey: 'duties.bq.official.mfn_excel',
  ftaSourceKey: 'duties.bq.official.fta_excel',
  mfnEnvVar: 'BQ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BQ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBqMfnOfficial = commands.mfn;
export const dutiesBqFtaOfficial = commands.fta;
export const dutiesBqAllOfficial = commands.all;
