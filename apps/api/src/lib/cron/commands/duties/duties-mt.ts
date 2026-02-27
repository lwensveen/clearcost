import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mt',
  dest: 'MT',
  mfnSourceKey: 'duties.mt.official.mfn_excel',
  ftaSourceKey: 'duties.mt.official.fta_excel',
  mfnEnvVar: 'MT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMtMfnOfficial = commands.mfn;
export const dutiesMtFtaOfficial = commands.fta;
export const dutiesMtAllOfficial = commands.all;
