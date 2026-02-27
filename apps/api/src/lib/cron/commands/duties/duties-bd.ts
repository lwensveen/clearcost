import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bd',
  dest: 'BD',
  mfnSourceKey: 'duties.bd.official.mfn_excel',
  ftaSourceKey: 'duties.bd.official.fta_excel',
  mfnEnvVar: 'BD_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BD_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBdMfnOfficial = commands.mfn;
export const dutiesBdFtaOfficial = commands.fta;
export const dutiesBdAllOfficial = commands.all;
