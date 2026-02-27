import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'io',
  dest: 'IO',
  mfnSourceKey: 'duties.io.official.mfn_excel',
  ftaSourceKey: 'duties.io.official.fta_excel',
  mfnEnvVar: 'IO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesIoMfnOfficial = commands.mfn;
export const dutiesIoFtaOfficial = commands.fta;
export const dutiesIoAllOfficial = commands.all;
