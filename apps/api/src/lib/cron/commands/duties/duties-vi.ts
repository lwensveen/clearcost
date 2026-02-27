import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'vi',
  dest: 'VI',
  mfnSourceKey: 'duties.vi.official.mfn_excel',
  ftaSourceKey: 'duties.vi.official.fta_excel',
  mfnEnvVar: 'VI_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'VI_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesViMfnOfficial = commands.mfn;
export const dutiesViFtaOfficial = commands.fta;
export const dutiesViAllOfficial = commands.all;
