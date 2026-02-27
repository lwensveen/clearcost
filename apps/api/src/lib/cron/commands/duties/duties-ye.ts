import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ye',
  dest: 'YE',
  mfnSourceKey: 'duties.ye.official.mfn_excel',
  ftaSourceKey: 'duties.ye.official.fta_excel',
  mfnEnvVar: 'YE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'YE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesYeMfnOfficial = commands.mfn;
export const dutiesYeFtaOfficial = commands.fta;
export const dutiesYeAllOfficial = commands.all;
