import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mf',
  dest: 'MF',
  mfnSourceKey: 'duties.mf.official.mfn_excel',
  ftaSourceKey: 'duties.mf.official.fta_excel',
  mfnEnvVar: 'MF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMfMfnOfficial = commands.mfn;
export const dutiesMfFtaOfficial = commands.fta;
export const dutiesMfAllOfficial = commands.all;
