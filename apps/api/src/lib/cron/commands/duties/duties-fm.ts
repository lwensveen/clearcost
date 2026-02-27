import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'fm',
  dest: 'FM',
  mfnSourceKey: 'duties.fm.official.mfn_excel',
  ftaSourceKey: 'duties.fm.official.fta_excel',
  mfnEnvVar: 'FM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'FM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesFmMfnOfficial = commands.mfn;
export const dutiesFmFtaOfficial = commands.fta;
export const dutiesFmAllOfficial = commands.all;
