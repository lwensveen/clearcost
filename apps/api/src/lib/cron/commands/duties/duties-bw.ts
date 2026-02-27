import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bw',
  dest: 'BW',
  mfnSourceKey: 'duties.bw.official.mfn_excel',
  ftaSourceKey: 'duties.bw.official.fta_excel',
  mfnEnvVar: 'BW_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BW_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBwMfnOfficial = commands.mfn;
export const dutiesBwFtaOfficial = commands.fta;
export const dutiesBwAllOfficial = commands.all;
