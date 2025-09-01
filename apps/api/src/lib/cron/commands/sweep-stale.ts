import { Command } from '../runtime.js';
import { sweepStaleImports } from '../../sweep-stale-imports.js';
import { parseFlags } from '../utils.js';

export const runSweepStale: Command = async (argv) => {
  const flags = parseFlags(argv);
  const thresholdMinutes = flags.threshold ? Number(flags.threshold) : undefined;
  const limit = flags.limit ? Number(flags.limit) : undefined;

  const res = await sweepStaleImports({ thresholdMinutes, limit });
  console.log(JSON.stringify(res, null, 2));
};
