import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'aw',
  dest: 'AW',
  mfnSourceKey: 'duties.aw.official.mfn_excel',
  ftaSourceKey: 'duties.aw.official.fta_excel',
  mfnEnvVar: 'AW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAwMfnOfficial = commands.mfn;
export const dutiesAwFtaOfficial = commands.fta;
export const dutiesAwAllOfficial = commands.all;
