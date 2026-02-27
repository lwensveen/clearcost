import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'hm',
  dest: 'HM',
  mfnSourceKey: 'duties.hm.official.mfn_excel',
  ftaSourceKey: 'duties.hm.official.fta_excel',
  mfnEnvVar: 'HM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'HM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesHmMfnOfficial = commands.mfn;
export const dutiesHmFtaOfficial = commands.fta;
export const dutiesHmAllOfficial = commands.all;
