import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mq',
  dest: 'MQ',
  mfnSourceKey: 'duties.mq.official.mfn_excel',
  ftaSourceKey: 'duties.mq.official.fta_excel',
  mfnEnvVar: 'MQ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MQ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMqMfnOfficial = commands.mfn;
export const dutiesMqFtaOfficial = commands.fta;
export const dutiesMqAllOfficial = commands.all;
