import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'va',
  dest: 'VA',
  mfnSourceKey: 'duties.va.official.mfn_excel',
  ftaSourceKey: 'duties.va.official.fta_excel',
  mfnEnvVar: 'VA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'VA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesVaMfnOfficial = commands.mfn;
export const dutiesVaFtaOfficial = commands.fta;
export const dutiesVaAllOfficial = commands.all;
