import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gm',
  dest: 'GM',
  mfnSourceKey: 'duties.gm.official.mfn_excel',
  ftaSourceKey: 'duties.gm.official.fta_excel',
  mfnEnvVar: 'GM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGmMfnOfficial = commands.mfn;
export const dutiesGmFtaOfficial = commands.fta;
export const dutiesGmAllOfficial = commands.all;
