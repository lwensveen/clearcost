import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cr',
  dest: 'CR',
  mfnSourceKey: 'duties.cr.official.mfn_excel',
  ftaSourceKey: 'duties.cr.official.fta_excel',
  mfnEnvVar: 'CR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCrMfnOfficial = commands.mfn;
export const dutiesCrFtaOfficial = commands.fta;
export const dutiesCrAllOfficial = commands.all;
