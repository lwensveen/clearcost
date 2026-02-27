import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'il',
  dest: 'IL',
  mfnSourceKey: 'duties.il.official.mfn_excel',
  ftaSourceKey: 'duties.il.official.fta_excel',
  mfnEnvVar: 'IL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesIlMfnOfficial = commands.mfn;
export const dutiesIlFtaOfficial = commands.fta;
export const dutiesIlAllOfficial = commands.all;
