import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cg',
  dest: 'CG',
  mfnSourceKey: 'duties.cg.official.mfn_excel',
  ftaSourceKey: 'duties.cg.official.fta_excel',
  mfnEnvVar: 'CG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCgMfnOfficial = commands.mfn;
export const dutiesCgFtaOfficial = commands.fta;
export const dutiesCgAllOfficial = commands.all;
