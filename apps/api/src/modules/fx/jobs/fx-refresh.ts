#!/usr/bin/env bun
import { refreshFx } from '../../../lib/refresh-fx.js';

refreshFx()
  .then((r) => {
    console.log(`FX updated: base=${r.base} asOf=${r.asOf} attemptedInserts=${r.inserted}`);
  })
  .catch((e) => {
    console.error('FX refresh failed:', e?.message ?? e);
    process.exit(1);
  });
