import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'az',
  dest: 'AZ',
  mfnSourceKey: 'duties.az.official.mfn_excel',
  ftaSourceKey: 'duties.az.official.fta_excel',
  mfnEnvVar: 'AZ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AZ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAzMfnOfficial = commands.mfn;
export const dutiesAzFtaOfficial = commands.fta;
export const dutiesAzAllOfficial = commands.all;
