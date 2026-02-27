import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'kp',
  dest: 'KP',
  mfnSourceKey: 'duties.kp.official.mfn_excel',
  ftaSourceKey: 'duties.kp.official.fta_excel',
  mfnEnvVar: 'KP_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KP_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKpMfnOfficial = commands.mfn;
export const dutiesKpFtaOfficial = commands.fta;
export const dutiesKpAllOfficial = commands.all;
