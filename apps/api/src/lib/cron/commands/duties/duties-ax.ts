import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'ax',
  dest: 'AX',
  mfnSourceKey: 'duties.ax.official.mfn_excel',
  ftaSourceKey: 'duties.ax.official.fta_excel',
  mfnEnvVar: 'AX_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'AX_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesAxMfnOfficial = commands.mfn;
export const dutiesAxFtaOfficial = commands.fta;
export const dutiesAxAllOfficial = commands.all;
