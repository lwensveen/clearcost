import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'na',
  dest: 'NA',
  mfnSourceKey: 'duties.na.official.mfn_excel',
  ftaSourceKey: 'duties.na.official.fta_excel',
  mfnEnvVar: 'NA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNaMfnOfficial = commands.mfn;
export const dutiesNaFtaOfficial = commands.fta;
export const dutiesNaAllOfficial = commands.all;
