import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ro',
  dest: 'RO',
  mfnSourceKey: 'duties.ro.official.mfn_excel',
  ftaSourceKey: 'duties.ro.official.fta_excel',
  mfnEnvVar: 'RO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'RO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesRoMfnOfficial = commands.mfn;
export const dutiesRoFtaOfficial = commands.fta;
export const dutiesRoAllOfficial = commands.all;
