import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'tl',
  dest: 'TL',
  mfnSourceKey: 'duties.tl.official.mfn_excel',
  ftaSourceKey: 'duties.tl.official.fta_excel',
  mfnEnvVar: 'TL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'TL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesTlMfnOfficial = commands.mfn;
export const dutiesTlFtaOfficial = commands.fta;
export const dutiesTlAllOfficial = commands.all;
