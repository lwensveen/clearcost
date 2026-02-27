import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'td',
  dest: 'TD',
  mfnSourceKey: 'duties.td.official.mfn_excel',
  ftaSourceKey: 'duties.td.official.fta_excel',
  mfnEnvVar: 'TD_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TD_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTdMfnOfficial = commands.mfn;
export const dutiesTdFtaOfficial = commands.fta;
export const dutiesTdAllOfficial = commands.all;
