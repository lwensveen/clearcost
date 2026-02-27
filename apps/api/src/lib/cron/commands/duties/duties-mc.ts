import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mc',
  dest: 'MC',
  mfnSourceKey: 'duties.mc.official.mfn_excel',
  ftaSourceKey: 'duties.mc.official.fta_excel',
  mfnEnvVar: 'MC_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MC_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMcMfnOfficial = commands.mfn;
export const dutiesMcFtaOfficial = commands.fta;
export const dutiesMcAllOfficial = commands.all;
