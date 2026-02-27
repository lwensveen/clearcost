import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cu',
  dest: 'CU',
  mfnSourceKey: 'duties.cu.official.mfn_excel',
  ftaSourceKey: 'duties.cu.official.fta_excel',
  mfnEnvVar: 'CU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCuMfnOfficial = commands.mfn;
export const dutiesCuFtaOfficial = commands.fta;
export const dutiesCuAllOfficial = commands.all;
