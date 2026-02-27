import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tk',
  dest: 'TK',
  mfnSourceKey: 'duties.tk.official.mfn_excel',
  ftaSourceKey: 'duties.tk.official.fta_excel',
  mfnEnvVar: 'TK_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TK_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTkMfnOfficial = commands.mfn;
export const dutiesTkFtaOfficial = commands.fta;
export const dutiesTkAllOfficial = commands.all;
