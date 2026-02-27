import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ec',
  dest: 'EC',
  mfnSourceKey: 'duties.ec.official.mfn_excel',
  ftaSourceKey: 'duties.ec.official.fta_excel',
  mfnEnvVar: 'EC_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'EC_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesEcMfnOfficial = commands.mfn;
export const dutiesEcFtaOfficial = commands.fta;
export const dutiesEcAllOfficial = commands.all;
