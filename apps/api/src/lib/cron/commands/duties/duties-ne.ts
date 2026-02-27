import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ne',
  dest: 'NE',
  mfnSourceKey: 'duties.ne.official.mfn_excel',
  ftaSourceKey: 'duties.ne.official.fta_excel',
  mfnEnvVar: 'NE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNeMfnOfficial = commands.mfn;
export const dutiesNeFtaOfficial = commands.fta;
export const dutiesNeAllOfficial = commands.all;
