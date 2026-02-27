import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ao',
  dest: 'AO',
  mfnSourceKey: 'duties.ao.official.mfn_excel',
  ftaSourceKey: 'duties.ao.official.fta_excel',
  mfnEnvVar: 'AO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAoMfnOfficial = commands.mfn;
export const dutiesAoFtaOfficial = commands.fta;
export const dutiesAoAllOfficial = commands.all;
