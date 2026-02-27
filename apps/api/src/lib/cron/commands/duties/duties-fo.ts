import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'fo',
  dest: 'FO',
  mfnSourceKey: 'duties.fo.official.mfn_excel',
  ftaSourceKey: 'duties.fo.official.fta_excel',
  mfnEnvVar: 'FO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'FO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesFoMfnOfficial = commands.mfn;
export const dutiesFoFtaOfficial = commands.fta;
export const dutiesFoAllOfficial = commands.all;
