import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sx',
  dest: 'SX',
  mfnSourceKey: 'duties.sx.official.mfn_excel',
  ftaSourceKey: 'duties.sx.official.fta_excel',
  mfnEnvVar: 'SX_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SX_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSxMfnOfficial = commands.mfn;
export const dutiesSxFtaOfficial = commands.fta;
export const dutiesSxAllOfficial = commands.all;
