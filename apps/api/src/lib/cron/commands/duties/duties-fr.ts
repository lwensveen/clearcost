import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'fr',
  dest: 'FR',
  mfnSourceKey: 'duties.fr.official.mfn_excel',
  ftaSourceKey: 'duties.fr.official.fta_excel',
  mfnEnvVar: 'FR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'FR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesFrMfnOfficial = commands.mfn;
export const dutiesFrFtaOfficial = commands.fta;
export const dutiesFrAllOfficial = commands.all;
