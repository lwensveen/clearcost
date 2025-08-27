// import { describe, expect, it } from 'vitest';
// import { acquireRunLock, makeLockKey, releaseRunLock } from './run-lock.js';
//
// const hasDB = !!process.env.DATABASE_URL;
//
// describe('run-lock (pg advisory lock)', () => {
//   if (!hasDB) {
//     it.skip('requires DATABASE_URL to run', () => {});
//     return;
//   }
//
//   it('acquires once, blocks second, releases, and re-acquires', async () => {
//     const key = makeLockKey({ source: 'TEST', job: 'lock' }, String(Math.random()));
//
//     const first = await acquireRunLock(key);
//     expect(first).toBe(true);
//
//     const second = await acquireRunLock(key);
//     expect(second).toBe(false);
//
//     await releaseRunLock(key);
//
//     const third = await acquireRunLock(key);
//     expect(third).toBe(true);
//
//     await releaseRunLock(key);
//   });
// });
