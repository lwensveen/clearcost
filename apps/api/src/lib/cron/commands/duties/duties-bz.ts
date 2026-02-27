import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bz',
  dest: 'BZ',
  mfnSourceKey: 'duties.bz.official.mfn_excel',
  ftaSourceKey: 'duties.bz.official.fta_excel',
  mfnEnvVar: 'BZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBzMfnOfficial = commands.mfn;
export const dutiesBzFtaOfficial = commands.fta;
export const dutiesBzAllOfficial = commands.all;
