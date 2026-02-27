import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cv',
  dest: 'CV',
  mfnSourceKey: 'duties.cv.official.mfn_excel',
  ftaSourceKey: 'duties.cv.official.fta_excel',
  mfnEnvVar: 'CV_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CV_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCvMfnOfficial = commands.mfn;
export const dutiesCvFtaOfficial = commands.fta;
export const dutiesCvAllOfficial = commands.all;
