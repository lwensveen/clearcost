import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'iq',
  dest: 'IQ',
  mfnSourceKey: 'duties.iq.official.mfn_excel',
  ftaSourceKey: 'duties.iq.official.fta_excel',
  mfnEnvVar: 'IQ_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IQ_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesIqMfnOfficial = commands.mfn;
export const dutiesIqFtaOfficial = commands.fta;
export const dutiesIqAllOfficial = commands.all;
