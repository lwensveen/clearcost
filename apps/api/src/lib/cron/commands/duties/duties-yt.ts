import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'yt',
  dest: 'YT',
  mfnSourceKey: 'duties.yt.official.mfn_excel',
  ftaSourceKey: 'duties.yt.official.fta_excel',
  mfnEnvVar: 'YT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'YT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesYtMfnOfficial = commands.mfn;
export const dutiesYtFtaOfficial = commands.fta;
export const dutiesYtAllOfficial = commands.all;
