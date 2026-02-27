import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'np',
  dest: 'NP',
  mfnSourceKey: 'duties.np.official.mfn_excel',
  ftaSourceKey: 'duties.np.official.fta_excel',
  mfnEnvVar: 'NP_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NP_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNpMfnOfficial = commands.mfn;
export const dutiesNpFtaOfficial = commands.fta;
export const dutiesNpAllOfficial = commands.all;
