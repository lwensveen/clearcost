import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'je',
  dest: 'JE',
  mfnSourceKey: 'duties.je.official.mfn_excel',
  ftaSourceKey: 'duties.je.official.fta_excel',
  mfnEnvVar: 'JE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'JE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesJeMfnOfficial = commands.mfn;
export const dutiesJeFtaOfficial = commands.fta;
export const dutiesJeAllOfficial = commands.all;
