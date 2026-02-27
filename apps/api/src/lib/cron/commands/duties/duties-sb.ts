import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sb',
  dest: 'SB',
  mfnSourceKey: 'duties.sb.official.mfn_excel',
  ftaSourceKey: 'duties.sb.official.fta_excel',
  mfnEnvVar: 'SB_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SB_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSbMfnOfficial = commands.mfn;
export const dutiesSbFtaOfficial = commands.fta;
export const dutiesSbAllOfficial = commands.all;
