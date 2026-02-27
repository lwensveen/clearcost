import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mh',
  dest: 'MH',
  mfnSourceKey: 'duties.mh.official.mfn_excel',
  ftaSourceKey: 'duties.mh.official.fta_excel',
  mfnEnvVar: 'MH_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MH_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMhMfnOfficial = commands.mfn;
export const dutiesMhFtaOfficial = commands.fta;
export const dutiesMhAllOfficial = commands.all;
