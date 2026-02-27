import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'dk',
  dest: 'DK',
  mfnSourceKey: 'duties.dk.official.mfn_excel',
  ftaSourceKey: 'duties.dk.official.fta_excel',
  mfnEnvVar: 'DK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'DK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesDkMfnOfficial = commands.mfn;
export const dutiesDkFtaOfficial = commands.fta;
export const dutiesDkAllOfficial = commands.all;
