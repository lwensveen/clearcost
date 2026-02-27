import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'cx',
  dest: 'CX',
  mfnSourceKey: 'duties.cx.official.mfn_excel',
  ftaSourceKey: 'duties.cx.official.fta_excel',
  mfnEnvVar: 'CX_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'CX_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesCxMfnOfficial = commands.mfn;
export const dutiesCxFtaOfficial = commands.fta;
export const dutiesCxAllOfficial = commands.all;
