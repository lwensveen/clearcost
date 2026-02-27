import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tc',
  dest: 'TC',
  mfnSourceKey: 'duties.tc.official.mfn_excel',
  ftaSourceKey: 'duties.tc.official.fta_excel',
  mfnEnvVar: 'TC_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TC_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTcMfnOfficial = commands.mfn;
export const dutiesTcFtaOfficial = commands.fta;
export const dutiesTcAllOfficial = commands.all;
