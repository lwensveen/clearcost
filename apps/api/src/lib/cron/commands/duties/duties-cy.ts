import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cy',
  dest: 'CY',
  mfnSourceKey: 'duties.cy.official.mfn_excel',
  ftaSourceKey: 'duties.cy.official.fta_excel',
  mfnEnvVar: 'CY_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CY_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCyMfnOfficial = commands.mfn;
export const dutiesCyFtaOfficial = commands.fta;
export const dutiesCyAllOfficial = commands.all;
