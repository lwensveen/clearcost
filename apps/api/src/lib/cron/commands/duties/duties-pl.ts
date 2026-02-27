import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pl',
  dest: 'PL',
  mfnSourceKey: 'duties.pl.official.mfn_excel',
  ftaSourceKey: 'duties.pl.official.fta_excel',
  mfnEnvVar: 'PL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPlMfnOfficial = commands.mfn;
export const dutiesPlFtaOfficial = commands.fta;
export const dutiesPlAllOfficial = commands.all;
