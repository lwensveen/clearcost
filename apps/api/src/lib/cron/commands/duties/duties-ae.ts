import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ae',
  dest: 'AE',
  mfnSourceKey: 'duties.ae.official.mfn_excel',
  ftaSourceKey: 'duties.ae.official.fta_excel',
  mfnEnvVar: 'AE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAeMfnOfficial = commands.mfn;
export const dutiesAeFtaOfficial = commands.fta;
export const dutiesAeAllOfficial = commands.all;
