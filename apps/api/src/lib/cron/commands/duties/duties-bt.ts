import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bt',
  dest: 'BT',
  mfnSourceKey: 'duties.bt.official.mfn_excel',
  ftaSourceKey: 'duties.bt.official.fta_excel',
  mfnEnvVar: 'BT_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BT_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBtMfnOfficial = commands.mfn;
export const dutiesBtFtaOfficial = commands.fta;
export const dutiesBtAllOfficial = commands.all;
