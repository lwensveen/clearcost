import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gl',
  dest: 'GL',
  mfnSourceKey: 'duties.gl.official.mfn_excel',
  ftaSourceKey: 'duties.gl.official.fta_excel',
  mfnEnvVar: 'GL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGlMfnOfficial = commands.mfn;
export const dutiesGlFtaOfficial = commands.fta;
export const dutiesGlAllOfficial = commands.all;
