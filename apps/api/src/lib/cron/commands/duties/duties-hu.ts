import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'hu',
  dest: 'HU',
  mfnSourceKey: 'duties.hu.official.mfn_excel',
  ftaSourceKey: 'duties.hu.official.fta_excel',
  mfnEnvVar: 'HU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'HU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesHuMfnOfficial = commands.mfn;
export const dutiesHuFtaOfficial = commands.fta;
export const dutiesHuAllOfficial = commands.all;
