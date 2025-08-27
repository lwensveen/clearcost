// import { describe, expect, test } from 'vitest';
// import { db, importsTable } from '@clearcost/db';
// import { eq } from 'drizzle-orm';
// import { sweepStaleImports } from './sweep-stale-imports.js';
//
// const hasDB = !!process.env.DATABASE_URL;
//
// test.skipIf(!hasDB)('requires DATABASE_URL to run', () => {});
//
// describe('sweep-stale-imports', () => {
//   test.runIf(hasDB)('marks old running imports as failed', async () => {
//     const past = new Date(Date.now() - 48 * 3600_000); // 48h ago
//
//     const [row] = await db
//       .insert(importsTable)
//       .values({
//         source: 'TEST' as any,
//         job: 'sweeper',
//         status: 'running' as any,
//         createdAt: past as any,
//         updatedAt: past as any,
//       } as any)
//       .returning({ id: importsTable.id });
//
//     expect(row?.id).toBeTruthy();
//
//     try {
//       const res = await sweepStaleImports({ thresholdMinutes: 30, limit: 10 });
//       expect(res.ok).toBe(true);
//       expect(res.swept).toBeGreaterThanOrEqual(1);
//
//       const [after] = await db
//         .select()
//         .from(importsTable)
//         .where(eq(importsTable.id, row!.id))
//         .limit(1);
//
//       expect(after).toBeTruthy();
//       expect(after!.status).toBe('failed');
//     } finally {
//       // cleanup
//       if (row?.id) {
//         await db.delete(importsTable).where(eq(importsTable.id, row.id));
//       }
//     }
//   });
// });
