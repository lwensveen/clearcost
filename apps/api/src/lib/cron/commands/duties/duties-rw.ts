import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'rw',
  dest: 'RW',
  mfnSourceKey: 'duties.rw.official.mfn_excel',
  ftaSourceKey: 'duties.rw.official.fta_excel',
  mfnEnvVar: 'RW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'RW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesRwMfnOfficial = commands.mfn;
export const dutiesRwFtaOfficial = commands.fta;
export const dutiesRwAllOfficial = commands.all;
