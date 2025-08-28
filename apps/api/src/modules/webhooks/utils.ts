import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const RAW_KEY = process.env.WEBHOOK_KMS_KEY || ''; // 32+ bytes of entropy from your secret manager
const KEY = createHash('sha256').update(RAW_KEY, 'utf8').digest(); // 32 bytes

export function encryptSecret(plaintext: string) {
  if (!RAW_KEY) throw new Error('WEBHOOK_KMS_KEY is not configured');

  const iv = randomBytes(12); // GCM nonce
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encB64u: enc.toString('base64url'),
    ivB64u: iv.toString('base64url'),
    tagB64u: tag.toString('base64url'),
  };
}

export function decryptSecret(encB64u: string, ivB64u: string, tagB64u: string) {
  if (!RAW_KEY) throw new Error('WEBHOOK_KMS_KEY is not configured');

  const iv = Buffer.from(ivB64u, 'base64url');
  const enc = Buffer.from(encB64u, 'base64url');
  const tag = Buffer.from(tagB64u, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);

  decipher.setAuthTag(tag);

  const out = Buffer.concat([decipher.update(enc), decipher.final()]);

  return out.toString('utf8');
}
