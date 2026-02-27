import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'im',
  dest: 'IM',
  mfnSourceKey: 'duties.im.official.mfn_excel',
  ftaSourceKey: 'duties.im.official.fta_excel',
  mfnEnvVar: 'IM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesImMfnOfficial = commands.mfn;
export const dutiesImFtaOfficial = commands.fta;
export const dutiesImAllOfficial = commands.all;
