import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gd',
  dest: 'GD',
  mfnSourceKey: 'duties.gd.official.mfn_excel',
  ftaSourceKey: 'duties.gd.official.fta_excel',
  mfnEnvVar: 'GD_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GD_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGdMfnOfficial = commands.mfn;
export const dutiesGdFtaOfficial = commands.fta;
export const dutiesGdAllOfficial = commands.all;
