import { apiKeysTable, db } from '@clearcost/db';
import { generateApiKey } from '../../../plugins/api-key-auth.js';
import { createHash } from 'node:crypto';

export async function issueApiKey({
  ownerId,
  name,
  scopes,
  prefix = 'live' as 'live' | 'test',
  expiresAt,
}: {
  ownerId: string;
  name: string;
  scopes: string[];
  prefix?: 'live' | 'test';
  expiresAt?: Date;
}) {
  const { token, keyId, secret, salt, prefix: pfx } = generateApiKey(prefix);
  const pepper = process.env.API_KEY_PEPPER ?? '';
  const tokenHash = createHash('sha256')
    .update(Buffer.from(`${salt}|${secret}|${pepper}`, 'utf8'))
    .digest('hex');

  const rows = await db
    .insert(apiKeysTable)
    .values({
      keyId,
      prefix: pfx,
      name,
      ownerId,
      salt,
      tokenHash,
      scopes,
      isActive: true,
      expiresAt: expiresAt ?? null,
    })
    .returning({ id: apiKeysTable.id, createdAt: apiKeysTable.createdAt });

  const row = rows[0];
  if (!row) throw new Error('Failed to create API key');

  return {
    id: row.id,
    token,
    keyId,
    prefix: pfx,
    name,
    ownerId,
    scopes,
    isActive: true,
    createdAt: row.createdAt,
  };
}
