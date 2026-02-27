import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'vu',
  dest: 'VU',
  mfnSourceKey: 'duties.vu.official.mfn_excel',
  ftaSourceKey: 'duties.vu.official.fta_excel',
  mfnEnvVar: 'VU_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'VU_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesVuMfnOfficial = commands.mfn;
export const dutiesVuFtaOfficial = commands.fta;
export const dutiesVuAllOfficial = commands.all;
