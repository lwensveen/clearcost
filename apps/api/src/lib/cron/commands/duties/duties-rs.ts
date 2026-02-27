import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'rs',
  dest: 'RS',
  mfnSourceKey: 'duties.rs.official.mfn_excel',
  ftaSourceKey: 'duties.rs.official.fta_excel',
  mfnEnvVar: 'RS_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'RS_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesRsMfnOfficial = commands.mfn;
export const dutiesRsFtaOfficial = commands.fta;
export const dutiesRsAllOfficial = commands.all;
