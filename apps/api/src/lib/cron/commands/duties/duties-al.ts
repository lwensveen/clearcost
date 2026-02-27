import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'al',
  dest: 'AL',
  mfnSourceKey: 'duties.al.official.mfn_excel',
  ftaSourceKey: 'duties.al.official.fta_excel',
  mfnEnvVar: 'AL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAlMfnOfficial = commands.mfn;
export const dutiesAlFtaOfficial = commands.fta;
export const dutiesAlAllOfficial = commands.all;
