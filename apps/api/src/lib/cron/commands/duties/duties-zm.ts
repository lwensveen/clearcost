import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'zm',
  dest: 'ZM',
  mfnSourceKey: 'duties.zm.official.mfn_excel',
  ftaSourceKey: 'duties.zm.official.fta_excel',
  mfnEnvVar: 'ZM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ZM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesZmMfnOfficial = commands.mfn;
export const dutiesZmFtaOfficial = commands.fta;
export const dutiesZmAllOfficial = commands.all;
