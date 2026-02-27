import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ba',
  dest: 'BA',
  mfnSourceKey: 'duties.ba.official.mfn_excel',
  ftaSourceKey: 'duties.ba.official.fta_excel',
  mfnEnvVar: 'BA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBaMfnOfficial = commands.mfn;
export const dutiesBaFtaOfficial = commands.fta;
export const dutiesBaAllOfficial = commands.all;
