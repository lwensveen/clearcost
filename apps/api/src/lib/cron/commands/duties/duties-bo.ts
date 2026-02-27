import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'bo',
  dest: 'BO',
  mfnSourceKey: 'duties.bo.official.mfn_excel',
  ftaSourceKey: 'duties.bo.official.fta_excel',
  mfnEnvVar: 'BO_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'BO_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesBoMfnOfficial = commands.mfn;
export const dutiesBoFtaOfficial = commands.fta;
export const dutiesBoAllOfficial = commands.all;
