import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ma',
  dest: 'MA',
  mfnSourceKey: 'duties.ma.official.mfn_excel',
  ftaSourceKey: 'duties.ma.official.fta_excel',
  mfnEnvVar: 'MA_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'MA_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesMaMfnOfficial = commands.mfn;
export const dutiesMaFtaOfficial = commands.fta;
export const dutiesMaAllOfficial = commands.all;
