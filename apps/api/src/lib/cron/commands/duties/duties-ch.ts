import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ch',
  dest: 'CH',
  mfnSourceKey: 'duties.ch.official.mfn_excel',
  ftaSourceKey: 'duties.ch.official.fta_excel',
  mfnEnvVar: 'CH_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CH_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesChMfnOfficial = commands.mfn;
export const dutiesChFtaOfficial = commands.fta;
export const dutiesChAllOfficial = commands.all;
