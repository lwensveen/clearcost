import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'me',
  dest: 'ME',
  mfnSourceKey: 'duties.me.official.mfn_excel',
  ftaSourceKey: 'duties.me.official.fta_excel',
  mfnEnvVar: 'ME_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ME_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMeMfnOfficial = commands.mfn;
export const dutiesMeFtaOfficial = commands.fta;
export const dutiesMeAllOfficial = commands.all;
