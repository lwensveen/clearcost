import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mg',
  dest: 'MG',
  mfnSourceKey: 'duties.mg.official.mfn_excel',
  ftaSourceKey: 'duties.mg.official.fta_excel',
  mfnEnvVar: 'MG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMgMfnOfficial = commands.mfn;
export const dutiesMgFtaOfficial = commands.fta;
export const dutiesMgAllOfficial = commands.all;
