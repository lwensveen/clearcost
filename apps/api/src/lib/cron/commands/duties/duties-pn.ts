import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pn',
  dest: 'PN',
  mfnSourceKey: 'duties.pn.official.mfn_excel',
  ftaSourceKey: 'duties.pn.official.fta_excel',
  mfnEnvVar: 'PN_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PN_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPnMfnOfficial = commands.mfn;
export const dutiesPnFtaOfficial = commands.fta;
export const dutiesPnAllOfficial = commands.all;
