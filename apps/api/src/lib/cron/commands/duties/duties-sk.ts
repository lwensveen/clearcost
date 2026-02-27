import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sk',
  dest: 'SK',
  mfnSourceKey: 'duties.sk.official.mfn_excel',
  ftaSourceKey: 'duties.sk.official.fta_excel',
  mfnEnvVar: 'SK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSkMfnOfficial = commands.mfn;
export const dutiesSkFtaOfficial = commands.fta;
export const dutiesSkAllOfficial = commands.all;
