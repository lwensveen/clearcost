import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'om',
  dest: 'OM',
  mfnSourceKey: 'duties.om.official.mfn_excel',
  ftaSourceKey: 'duties.om.official.fta_excel',
  mfnEnvVar: 'OM_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'OM_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesOmMfnOfficial = commands.mfn;
export const dutiesOmFtaOfficial = commands.fta;
export const dutiesOmAllOfficial = commands.all;
