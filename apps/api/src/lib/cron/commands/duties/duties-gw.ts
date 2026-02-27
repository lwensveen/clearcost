import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gw',
  dest: 'GW',
  mfnSourceKey: 'duties.gw.official.mfn_excel',
  ftaSourceKey: 'duties.gw.official.fta_excel',
  mfnEnvVar: 'GW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGwMfnOfficial = commands.mfn;
export const dutiesGwFtaOfficial = commands.fta;
export const dutiesGwAllOfficial = commands.all;
