// import { describe, expect, it, test } from 'vitest';
// import { buildMini } from './fixtures/mini-app.js';
//
// const hasDB = !!process.env.DATABASE_URL;
//
// test.skipIf(!hasDB)('requires DATABASE_URL to run', () => {});
//
// describe('import-instrumentation route lock', () => {
//   it.runIf(hasDB)('second concurrent call returns 409', async () => {
//     const app = await buildMini();
//     try {
//       const p1 = app.inject({ method: 'POST', url: '/lock/me' });
//       const p2 = app.inject({ method: 'POST', url: '/lock/me' });
//
//       const [r1, r2] = await Promise.all([p1, p2]);
//       const statuses = [r1.statusCode, r2.statusCode].sort((a, b) => a - b);
//
//       expect(statuses).toEqual([200, 409]);
//     } finally {
//       await app.close();
//     }
//   });
// });
