import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'vc',
  dest: 'VC',
  mfnSourceKey: 'duties.vc.official.mfn_excel',
  ftaSourceKey: 'duties.vc.official.fta_excel',
  mfnEnvVar: 'VC_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'VC_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesVcMfnOfficial = commands.mfn;
export const dutiesVcFtaOfficial = commands.fta;
export const dutiesVcAllOfficial = commands.all;
