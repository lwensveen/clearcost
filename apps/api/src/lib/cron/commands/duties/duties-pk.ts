import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pk',
  dest: 'PK',
  mfnSourceKey: 'duties.pk.official.mfn_excel',
  ftaSourceKey: 'duties.pk.official.fta_excel',
  mfnEnvVar: 'PK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPkMfnOfficial = commands.mfn;
export const dutiesPkFtaOfficial = commands.fta;
export const dutiesPkAllOfficial = commands.all;
