import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'lc',
  dest: 'LC',
  mfnSourceKey: 'duties.lc.official.mfn_excel',
  ftaSourceKey: 'duties.lc.official.fta_excel',
  mfnEnvVar: 'LC_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LC_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLcMfnOfficial = commands.mfn;
export const dutiesLcFtaOfficial = commands.fta;
export const dutiesLcAllOfficial = commands.all;
