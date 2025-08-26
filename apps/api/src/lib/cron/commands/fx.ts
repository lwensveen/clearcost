import type { Command } from '../runtime.js';
import { withRun } from '../runtime.js';
import { refreshFx } from '../../refresh-fx.js';

export const fxRefresh: Command = async () => {
  const payload = await withRun<{ ok: true; inserted: number }>(
    { source: 'ECB', job: 'fx:daily' },
    async () => {
      const { inserted } = await refreshFx();
      return { inserted, payload: { ok: true, inserted } };
    }
  );
  console.log(payload);
};
