import { createCountryOfficialDutyCommands } from './duties-country-official-excel.js';

const commands = createCountryOfficialDutyCommands({
  slug: 'py',
  dest: 'PY',
  mfnSourceKey: 'duties.py.official.mfn_excel',
  ftaSourceKey: 'duties.py.official.fta_excel',
  mfnEnvVar: 'PY_MFN_OFFICIAL_EXCEL_URL',
  ftaEnvVar: 'PY_FTA_OFFICIAL_EXCEL_URL',
});

export const dutiesPyMfnOfficial = commands.mfn;
export const dutiesPyFtaOfficial = commands.fta;
export const dutiesPyAllOfficial = commands.all;
