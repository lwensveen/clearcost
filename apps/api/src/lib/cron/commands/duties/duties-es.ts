import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'es',
  dest: 'ES',
  mfnSourceKey: 'duties.es.official.mfn_excel',
  ftaSourceKey: 'duties.es.official.fta_excel',
  mfnEnvVar: 'ES_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'ES_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesEsMfnOfficial = commands.mfn;
export const dutiesEsFtaOfficial = commands.fta;
export const dutiesEsAllOfficial = commands.all;
