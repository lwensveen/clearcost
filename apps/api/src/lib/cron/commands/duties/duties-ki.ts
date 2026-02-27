import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ki',
  dest: 'KI',
  mfnSourceKey: 'duties.ki.official.mfn_excel',
  ftaSourceKey: 'duties.ki.official.fta_excel',
  mfnEnvVar: 'KI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'KI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesKiMfnOfficial = commands.mfn;
export const dutiesKiFtaOfficial = commands.fta;
export const dutiesKiAllOfficial = commands.all;
