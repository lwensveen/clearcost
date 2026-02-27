import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mk',
  dest: 'MK',
  mfnSourceKey: 'duties.mk.official.mfn_excel',
  ftaSourceKey: 'duties.mk.official.fta_excel',
  mfnEnvVar: 'MK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMkMfnOfficial = commands.mfn;
export const dutiesMkFtaOfficial = commands.fta;
export const dutiesMkAllOfficial = commands.all;
