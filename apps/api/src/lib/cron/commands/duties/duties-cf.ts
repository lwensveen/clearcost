import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cf',
  dest: 'CF',
  mfnSourceKey: 'duties.cf.official.mfn_excel',
  ftaSourceKey: 'duties.cf.official.fta_excel',
  mfnEnvVar: 'CF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCfMfnOfficial = commands.mfn;
export const dutiesCfFtaOfficial = commands.fta;
export const dutiesCfAllOfficial = commands.all;
