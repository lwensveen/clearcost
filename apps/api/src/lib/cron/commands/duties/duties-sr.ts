import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'sr',
  dest: 'SR',
  mfnSourceKey: 'duties.sr.official.mfn_excel',
  ftaSourceKey: 'duties.sr.official.fta_excel',
  mfnEnvVar: 'SR_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'SR_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesSrMfnOfficial = commands.mfn;
export const dutiesSrFtaOfficial = commands.fta;
export const dutiesSrAllOfficial = commands.all;
