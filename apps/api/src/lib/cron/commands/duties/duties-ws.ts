import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ws',
  dest: 'WS',
  mfnSourceKey: 'duties.ws.official.mfn_excel',
  ftaSourceKey: 'duties.ws.official.fta_excel',
  mfnEnvVar: 'WS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'WS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesWsMfnOfficial = commands.mfn;
export const dutiesWsFtaOfficial = commands.fta;
export const dutiesWsAllOfficial = commands.all;
