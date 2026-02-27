import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ag',
  dest: 'AG',
  mfnSourceKey: 'duties.ag.official.mfn_excel',
  ftaSourceKey: 'duties.ag.official.fta_excel',
  mfnEnvVar: 'AG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAgMfnOfficial = commands.mfn;
export const dutiesAgFtaOfficial = commands.fta;
export const dutiesAgAllOfficial = commands.all;
