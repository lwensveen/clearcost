import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ml',
  dest: 'ML',
  mfnSourceKey: 'duties.ml.official.mfn_excel',
  ftaSourceKey: 'duties.ml.official.fta_excel',
  mfnEnvVar: 'ML_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ML_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMlMfnOfficial = commands.mfn;
export const dutiesMlFtaOfficial = commands.fta;
export const dutiesMlAllOfficial = commands.all;
