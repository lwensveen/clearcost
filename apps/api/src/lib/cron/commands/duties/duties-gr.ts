import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gr',
  dest: 'GR',
  mfnSourceKey: 'duties.gr.official.mfn_excel',
  ftaSourceKey: 'duties.gr.official.fta_excel',
  mfnEnvVar: 'GR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGrMfnOfficial = commands.mfn;
export const dutiesGrFtaOfficial = commands.fta;
export const dutiesGrAllOfficial = commands.all;
