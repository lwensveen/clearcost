import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'er',
  dest: 'ER',
  mfnSourceKey: 'duties.er.official.mfn_excel',
  ftaSourceKey: 'duties.er.official.fta_excel',
  mfnEnvVar: 'ER_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ER_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesErMfnOfficial = commands.mfn;
export const dutiesErFtaOfficial = commands.fta;
export const dutiesErAllOfficial = commands.all;
