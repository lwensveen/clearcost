import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gn',
  dest: 'GN',
  mfnSourceKey: 'duties.gn.official.mfn_excel',
  ftaSourceKey: 'duties.gn.official.fta_excel',
  mfnEnvVar: 'GN_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GN_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGnMfnOfficial = commands.mfn;
export const dutiesGnFtaOfficial = commands.fta;
export const dutiesGnAllOfficial = commands.all;
