import { db, sourceRegistryTable } from '@clearcost/db';
import type { Command } from '../runtime.js';
import { withRun } from '../runtime.js';
import { flagBool, parseFlags } from '../utils.js';
import { SOURCE_REGISTRY_DEFAULT_ENTRIES } from '../../source-registry/defaults.js';

export const sourceRegistryBootstrap: Command = async (argv = []) => {
  const flags = parseFlags(argv);
  const dryRun = flagBool(flags, 'dry-run');

  if (dryRun) {
    console.log({
      dryRun: true,
      keyCount: SOURCE_REGISTRY_DEFAULT_ENTRIES.length,
      keys: SOURCE_REGISTRY_DEFAULT_ENTRIES.map((entry) => entry.key),
    });
    return;
  }

  const payload = await withRun<{ ok: true; upserted: number; keyCount: number }>(
    {
      importSource: 'SEED',
      job: 'source-registry:bootstrap',
      sourceKey: 'source-registry.defaults',
      params: { keyCount: SOURCE_REGISTRY_DEFAULT_ENTRIES.length },
    },
    async () => {
      await db.transaction(async (tx) => {
        for (const entry of SOURCE_REGISTRY_DEFAULT_ENTRIES) {
          await tx
            .insert(sourceRegistryTable)
            .values({
              key: entry.key,
              dataset: entry.dataset,
              sourceType: entry.sourceType,
              scheduleHint: entry.scheduleHint,
              expectedFormat: entry.expectedFormat,
              authStrategy: entry.authStrategy,
              parserVersion: entry.parserVersion,
              notes: entry.notes,
            })
            .onConflictDoUpdate({
              target: sourceRegistryTable.key,
              set: {
                dataset: entry.dataset,
                sourceType: entry.sourceType,
                scheduleHint: entry.scheduleHint,
                expectedFormat: entry.expectedFormat,
                authStrategy: entry.authStrategy,
                parserVersion: entry.parserVersion,
                notes: entry.notes,
              },
            });
        }
      });

      return {
        inserted: SOURCE_REGISTRY_DEFAULT_ENTRIES.length,
        payload: {
          ok: true,
          upserted: SOURCE_REGISTRY_DEFAULT_ENTRIES.length,
          keyCount: SOURCE_REGISTRY_DEFAULT_ENTRIES.length,
        },
      };
    }
  );

  console.log(payload);
};
