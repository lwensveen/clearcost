import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'jo',
  dest: 'JO',
  mfnSourceKey: 'duties.jo.official.mfn_excel',
  ftaSourceKey: 'duties.jo.official.fta_excel',
  mfnEnvVar: 'JO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'JO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesJoMfnOfficial = commands.mfn;
export const dutiesJoFtaOfficial = commands.fta;
export const dutiesJoAllOfficial = commands.all;
