import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ge',
  dest: 'GE',
  mfnSourceKey: 'duties.ge.official.mfn_excel',
  ftaSourceKey: 'duties.ge.official.fta_excel',
  mfnEnvVar: 'GE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGeMfnOfficial = commands.mfn;
export const dutiesGeFtaOfficial = commands.fta;
export const dutiesGeAllOfficial = commands.all;
