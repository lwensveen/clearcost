import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'za',
  dest: 'ZA',
  mfnSourceKey: 'duties.za.official.mfn_excel',
  ftaSourceKey: 'duties.za.official.fta_excel',
  mfnEnvVar: 'ZA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ZA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesZaMfnOfficial = commands.mfn;
export const dutiesZaFtaOfficial = commands.fta;
export const dutiesZaAllOfficial = commands.all;
