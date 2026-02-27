import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'um',
  dest: 'UM',
  mfnSourceKey: 'duties.um.official.mfn_excel',
  ftaSourceKey: 'duties.um.official.fta_excel',
  mfnEnvVar: 'UM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'UM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesUmMfnOfficial = commands.mfn;
export const dutiesUmFtaOfficial = commands.fta;
export const dutiesUmAllOfficial = commands.all;
