import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'lb',
  dest: 'LB',
  mfnSourceKey: 'duties.lb.official.mfn_excel',
  ftaSourceKey: 'duties.lb.official.fta_excel',
  mfnEnvVar: 'LB_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LB_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLbMfnOfficial = commands.mfn;
export const dutiesLbFtaOfficial = commands.fta;
export const dutiesLbAllOfficial = commands.all;
