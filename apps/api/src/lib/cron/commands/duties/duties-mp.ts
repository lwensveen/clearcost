import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mp',
  dest: 'MP',
  mfnSourceKey: 'duties.mp.official.mfn_excel',
  ftaSourceKey: 'duties.mp.official.fta_excel',
  mfnEnvVar: 'MP_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MP_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMpMfnOfficial = commands.mfn;
export const dutiesMpFtaOfficial = commands.fta;
export const dutiesMpAllOfficial = commands.all;
