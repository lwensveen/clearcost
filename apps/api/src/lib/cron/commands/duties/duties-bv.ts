import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bv',
  dest: 'BV',
  mfnSourceKey: 'duties.bv.official.mfn_excel',
  ftaSourceKey: 'duties.bv.official.fta_excel',
  mfnEnvVar: 'BV_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BV_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBvMfnOfficial = commands.mfn;
export const dutiesBvFtaOfficial = commands.fta;
export const dutiesBvAllOfficial = commands.all;
