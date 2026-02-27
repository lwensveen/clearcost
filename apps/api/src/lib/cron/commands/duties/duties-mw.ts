import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mw',
  dest: 'MW',
  mfnSourceKey: 'duties.mw.official.mfn_excel',
  ftaSourceKey: 'duties.mw.official.fta_excel',
  mfnEnvVar: 'MW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMwMfnOfficial = commands.mfn;
export const dutiesMwFtaOfficial = commands.fta;
export const dutiesMwAllOfficial = commands.all;
