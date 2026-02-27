import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'fi',
  dest: 'FI',
  mfnSourceKey: 'duties.fi.official.mfn_excel',
  ftaSourceKey: 'duties.fi.official.fta_excel',
  mfnEnvVar: 'FI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'FI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesFiMfnOfficial = commands.mfn;
export const dutiesFiFtaOfficial = commands.fta;
export const dutiesFiAllOfficial = commands.all;
