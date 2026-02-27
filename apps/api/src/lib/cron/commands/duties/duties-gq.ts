import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gq',
  dest: 'GQ',
  mfnSourceKey: 'duties.gq.official.mfn_excel',
  ftaSourceKey: 'duties.gq.official.fta_excel',
  mfnEnvVar: 'GQ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GQ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGqMfnOfficial = commands.mfn;
export const dutiesGqFtaOfficial = commands.fta;
export const dutiesGqAllOfficial = commands.all;
