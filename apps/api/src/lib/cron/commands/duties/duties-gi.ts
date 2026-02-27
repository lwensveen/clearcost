import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'gi',
  dest: 'GI',
  mfnSourceKey: 'duties.gi.official.mfn_excel',
  ftaSourceKey: 'duties.gi.official.fta_excel',
  mfnEnvVar: 'GI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'GI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesGiMfnOfficial = commands.mfn;
export const dutiesGiFtaOfficial = commands.fta;
export const dutiesGiAllOfficial = commands.all;
