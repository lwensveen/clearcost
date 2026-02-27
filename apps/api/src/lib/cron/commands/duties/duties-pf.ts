import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pf',
  dest: 'PF',
  mfnSourceKey: 'duties.pf.official.mfn_excel',
  ftaSourceKey: 'duties.pf.official.fta_excel',
  mfnEnvVar: 'PF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPfMfnOfficial = commands.mfn;
export const dutiesPfFtaOfficial = commands.fta;
export const dutiesPfAllOfficial = commands.all;
