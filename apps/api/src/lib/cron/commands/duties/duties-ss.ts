import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ss',
  dest: 'SS',
  mfnSourceKey: 'duties.ss.official.mfn_excel',
  ftaSourceKey: 'duties.ss.official.fta_excel',
  mfnEnvVar: 'SS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSsMfnOfficial = commands.mfn;
export const dutiesSsFtaOfficial = commands.fta;
export const dutiesSsAllOfficial = commands.all;
