import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'wf',
  dest: 'WF',
  mfnSourceKey: 'duties.wf.official.mfn_excel',
  ftaSourceKey: 'duties.wf.official.fta_excel',
  mfnEnvVar: 'WF_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'WF_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesWfMfnOfficial = commands.mfn;
export const dutiesWfFtaOfficial = commands.fta;
export const dutiesWfAllOfficial = commands.all;
