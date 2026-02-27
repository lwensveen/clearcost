import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'nu',
  dest: 'NU',
  mfnSourceKey: 'duties.nu.official.mfn_excel',
  ftaSourceKey: 'duties.nu.official.fta_excel',
  mfnEnvVar: 'NU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNuMfnOfficial = commands.mfn;
export const dutiesNuFtaOfficial = commands.fta;
export const dutiesNuAllOfficial = commands.all;
