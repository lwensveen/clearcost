import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sl',
  dest: 'SL',
  mfnSourceKey: 'duties.sl.official.mfn_excel',
  ftaSourceKey: 'duties.sl.official.fta_excel',
  mfnEnvVar: 'SL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSlMfnOfficial = commands.mfn;
export const dutiesSlFtaOfficial = commands.fta;
export const dutiesSlAllOfficial = commands.all;
