import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ni',
  dest: 'NI',
  mfnSourceKey: 'duties.ni.official.mfn_excel',
  ftaSourceKey: 'duties.ni.official.fta_excel',
  mfnEnvVar: 'NI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'NI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesNiMfnOfficial = commands.mfn;
export const dutiesNiFtaOfficial = commands.fta;
export const dutiesNiAllOfficial = commands.all;
