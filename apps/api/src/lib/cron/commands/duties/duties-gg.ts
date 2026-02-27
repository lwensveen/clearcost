import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gg',
  dest: 'GG',
  mfnSourceKey: 'duties.gg.official.mfn_excel',
  ftaSourceKey: 'duties.gg.official.fta_excel',
  mfnEnvVar: 'GG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGgMfnOfficial = commands.mfn;
export const dutiesGgFtaOfficial = commands.fta;
export const dutiesGgAllOfficial = commands.all;
