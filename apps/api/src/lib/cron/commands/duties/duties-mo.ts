import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mo',
  dest: 'MO',
  mfnSourceKey: 'duties.mo.official.mfn_excel',
  ftaSourceKey: 'duties.mo.official.fta_excel',
  mfnEnvVar: 'MO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMoMfnOfficial = commands.mfn;
export const dutiesMoFtaOfficial = commands.fta;
export const dutiesMoAllOfficial = commands.all;
