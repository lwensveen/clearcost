import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tt',
  dest: 'TT',
  mfnSourceKey: 'duties.tt.official.mfn_excel',
  ftaSourceKey: 'duties.tt.official.fta_excel',
  mfnEnvVar: 'TT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTtMfnOfficial = commands.mfn;
export const dutiesTtFtaOfficial = commands.fta;
export const dutiesTtAllOfficial = commands.all;
