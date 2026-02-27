import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ie',
  dest: 'IE',
  mfnSourceKey: 'duties.ie.official.mfn_excel',
  ftaSourceKey: 'duties.ie.official.fta_excel',
  mfnEnvVar: 'IE_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'IE_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesIeMfnOfficial = commands.mfn;
export const dutiesIeFtaOfficial = commands.fta;
export const dutiesIeAllOfficial = commands.all;
