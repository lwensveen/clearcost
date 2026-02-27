import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'at',
  dest: 'AT',
  mfnSourceKey: 'duties.at.official.mfn_excel',
  ftaSourceKey: 'duties.at.official.fta_excel',
  mfnEnvVar: 'AT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAtMfnOfficial = commands.mfn;
export const dutiesAtFtaOfficial = commands.fta;
export const dutiesAtAllOfficial = commands.all;
