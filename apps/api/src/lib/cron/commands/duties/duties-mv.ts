import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'mv',
  dest: 'MV',
  mfnSourceKey: 'duties.mv.official.mfn_excel',
  ftaSourceKey: 'duties.mv.official.fta_excel',
  mfnEnvVar: 'MV_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MV_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMvMfnOfficial = commands.mfn;
export const dutiesMvFtaOfficial = commands.fta;
export const dutiesMvAllOfficial = commands.all;
