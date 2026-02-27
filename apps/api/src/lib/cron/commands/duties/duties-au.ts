import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'au',
  dest: 'AU',
  mfnSourceKey: 'duties.au.official.mfn_excel',
  ftaSourceKey: 'duties.au.official.fta_excel',
  mfnEnvVar: 'AU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAuMfnOfficial = commands.mfn;
export const dutiesAuFtaOfficial = commands.fta;
export const dutiesAuAllOfficial = commands.all;
