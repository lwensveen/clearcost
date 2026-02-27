import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cc',
  dest: 'CC',
  mfnSourceKey: 'duties.cc.official.mfn_excel',
  ftaSourceKey: 'duties.cc.official.fta_excel',
  mfnEnvVar: 'CC_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CC_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCcMfnOfficial = commands.mfn;
export const dutiesCcFtaOfficial = commands.fta;
export const dutiesCcAllOfficial = commands.all;
