import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'lv',
  dest: 'LV',
  mfnSourceKey: 'duties.lv.official.mfn_excel',
  ftaSourceKey: 'duties.lv.official.fta_excel',
  mfnEnvVar: 'LV_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LV_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLvMfnOfficial = commands.mfn;
export const dutiesLvFtaOfficial = commands.fta;
export const dutiesLvAllOfficial = commands.all;
