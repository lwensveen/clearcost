import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ar',
  dest: 'AR',
  mfnSourceKey: 'duties.ar.official.mfn_excel',
  ftaSourceKey: 'duties.ar.official.fta_excel',
  mfnEnvVar: 'AR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesArMfnOfficial = commands.mfn;
export const dutiesArFtaOfficial = commands.fta;
export const dutiesArAllOfficial = commands.all;
