import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sm',
  dest: 'SM',
  mfnSourceKey: 'duties.sm.official.mfn_excel',
  ftaSourceKey: 'duties.sm.official.fta_excel',
  mfnEnvVar: 'SM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSmMfnOfficial = commands.mfn;
export const dutiesSmFtaOfficial = commands.fta;
export const dutiesSmAllOfficial = commands.all;
