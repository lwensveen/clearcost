import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sd',
  dest: 'SD',
  mfnSourceKey: 'duties.sd.official.mfn_excel',
  ftaSourceKey: 'duties.sd.official.fta_excel',
  mfnEnvVar: 'SD_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SD_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSdMfnOfficial = commands.mfn;
export const dutiesSdFtaOfficial = commands.fta;
export const dutiesSdAllOfficial = commands.all;
