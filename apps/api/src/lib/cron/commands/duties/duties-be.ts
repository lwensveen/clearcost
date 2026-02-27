import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'be',
  dest: 'BE',
  mfnSourceKey: 'duties.be.official.mfn_excel',
  ftaSourceKey: 'duties.be.official.fta_excel',
  mfnEnvVar: 'BE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBeMfnOfficial = commands.mfn;
export const dutiesBeFtaOfficial = commands.fta;
export const dutiesBeAllOfficial = commands.all;
