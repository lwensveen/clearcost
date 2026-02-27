import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mx',
  dest: 'MX',
  mfnSourceKey: 'duties.mx.official.mfn_excel',
  ftaSourceKey: 'duties.mx.official.fta_excel',
  mfnEnvVar: 'MX_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MX_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMxMfnOfficial = commands.mfn;
export const dutiesMxFtaOfficial = commands.fta;
export const dutiesMxAllOfficial = commands.all;
