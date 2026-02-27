import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ee',
  dest: 'EE',
  mfnSourceKey: 'duties.ee.official.mfn_excel',
  ftaSourceKey: 'duties.ee.official.fta_excel',
  mfnEnvVar: 'EE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'EE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesEeMfnOfficial = commands.mfn;
export const dutiesEeFtaOfficial = commands.fta;
export const dutiesEeAllOfficial = commands.all;
