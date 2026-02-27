import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'nr',
  dest: 'NR',
  mfnSourceKey: 'duties.nr.official.mfn_excel',
  ftaSourceKey: 'duties.nr.official.fta_excel',
  mfnEnvVar: 'NR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNrMfnOfficial = commands.mfn;
export const dutiesNrFtaOfficial = commands.fta;
export const dutiesNrAllOfficial = commands.all;
