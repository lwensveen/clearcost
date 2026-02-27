import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'dm',
  dest: 'DM',
  mfnSourceKey: 'duties.dm.official.mfn_excel',
  ftaSourceKey: 'duties.dm.official.fta_excel',
  mfnEnvVar: 'DM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'DM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesDmMfnOfficial = commands.mfn;
export const dutiesDmFtaOfficial = commands.fta;
export const dutiesDmAllOfficial = commands.all;
