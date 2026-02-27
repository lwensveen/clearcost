import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'zw',
  dest: 'ZW',
  mfnSourceKey: 'duties.zw.official.mfn_excel',
  ftaSourceKey: 'duties.zw.official.fta_excel',
  mfnEnvVar: 'ZW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ZW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesZwMfnOfficial = commands.mfn;
export const dutiesZwFtaOfficial = commands.fta;
export const dutiesZwAllOfficial = commands.all;
