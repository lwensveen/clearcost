import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bl',
  dest: 'BL',
  mfnSourceKey: 'duties.bl.official.mfn_excel',
  ftaSourceKey: 'duties.bl.official.fta_excel',
  mfnEnvVar: 'BL_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BL_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBlMfnOfficial = commands.mfn;
export const dutiesBlFtaOfficial = commands.fta;
export const dutiesBlAllOfficial = commands.all;
