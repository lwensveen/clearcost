import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gs',
  dest: 'GS',
  mfnSourceKey: 'duties.gs.official.mfn_excel',
  ftaSourceKey: 'duties.gs.official.fta_excel',
  mfnEnvVar: 'GS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGsMfnOfficial = commands.mfn;
export const dutiesGsFtaOfficial = commands.fta;
export const dutiesGsAllOfficial = commands.all;
