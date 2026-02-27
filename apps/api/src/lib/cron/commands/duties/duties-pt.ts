import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'pt',
  dest: 'PT',
  mfnSourceKey: 'duties.pt.official.mfn_excel',
  ftaSourceKey: 'duties.pt.official.fta_excel',
  mfnEnvVar: 'PT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPtMfnOfficial = commands.mfn;
export const dutiesPtFtaOfficial = commands.fta;
export const dutiesPtAllOfficial = commands.all;
