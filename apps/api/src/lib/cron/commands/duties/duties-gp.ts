import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gp',
  dest: 'GP',
  mfnSourceKey: 'duties.gp.official.mfn_excel',
  ftaSourceKey: 'duties.gp.official.fta_excel',
  mfnEnvVar: 'GP_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GP_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGpMfnOfficial = commands.mfn;
export const dutiesGpFtaOfficial = commands.fta;
export const dutiesGpAllOfficial = commands.all;
