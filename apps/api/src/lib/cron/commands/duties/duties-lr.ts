import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'lr',
  dest: 'LR',
  mfnSourceKey: 'duties.lr.official.mfn_excel',
  ftaSourceKey: 'duties.lr.official.fta_excel',
  mfnEnvVar: 'LR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'LR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesLrMfnOfficial = commands.mfn;
export const dutiesLrFtaOfficial = commands.fta;
export const dutiesLrAllOfficial = commands.all;
