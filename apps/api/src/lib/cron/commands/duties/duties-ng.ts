import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ng',
  dest: 'NG',
  mfnSourceKey: 'duties.ng.official.mfn_excel',
  ftaSourceKey: 'duties.ng.official.fta_excel',
  mfnEnvVar: 'NG_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NG_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNgMfnOfficial = commands.mfn;
export const dutiesNgFtaOfficial = commands.fta;
export const dutiesNgAllOfficial = commands.all;
