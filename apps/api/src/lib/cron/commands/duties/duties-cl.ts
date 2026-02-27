import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cl',
  dest: 'CL',
  mfnSourceKey: 'duties.cl.official.mfn_excel',
  ftaSourceKey: 'duties.cl.official.fta_excel',
  mfnEnvVar: 'CL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesClMfnOfficial = commands.mfn;
export const dutiesClFtaOfficial = commands.fta;
export const dutiesClAllOfficial = commands.all;
