import { describe, expect, it, vi } from 'vitest';

const SUT = './secret-kms.js';

/** Import the SUT fresh with a specific WEBHOOK_KMS_KEY value. */
async function importWithKey(key: string | undefined) {
  vi.resetModules();
  if (key === undefined || key === '') {
    delete process.env.WEBHOOK_KMS_KEY;
  } else {
    process.env.WEBHOOK_KMS_KEY = key;
  }
  return await import(SUT);
}

describe('encryptSecret / decryptSecret (AES-256-GCM)', () => {
  it('round-trips plaintext and returns base64url parts', async () => {
    const { encryptSecret, decryptSecret } = await importWithKey('test-key-123');

    const plaintext = 'hello 🌍 — こんにちは';
    const out = encryptSecret(plaintext);

    expect(typeof out.encB64u).toBe('string');
    expect(typeof out.ivB64u).toBe('string');
    expect(typeof out.tagB64u).toBe('string');
    expect(out.encB64u).not.toMatch(/[+/=]/);
    expect(out.ivB64u).not.toMatch(/[+/=]/);
    expect(out.tagB64u).not.toMatch(/[+/=]/);

    const ivBytes = Buffer.from(out.ivB64u, 'base64url');
    const tagBytes = Buffer.from(out.tagB64u, 'base64url');
    expect(ivBytes.length).toBe(12);
    expect(tagBytes.length).toBe(16);

    const decrypted = decryptSecret(out.encB64u, out.ivB64u, out.tagB64u);
    expect(decrypted).toBe(plaintext);
  });

  it('throws if WEBHOOK_KMS_KEY is unset', async () => {
    const { encryptSecret, decryptSecret } = await importWithKey('');

    expect(() => encryptSecret('x')).toThrow(/WEBHOOK_KMS_KEY/i);
    expect(() => decryptSecret('a', 'b', 'c')).toThrow(/WEBHOOK_KMS_KEY/i);
  });

  it('fails to decrypt with a different key (key rotation / mismatch)', async () => {
    const modA = await importWithKey('key-A');
    const { encB64u, ivB64u, tagB64u } = modA.encryptSecret('payload-123');

    const modB = await importWithKey('key-B');
    expect(() => modB.decryptSecret(encB64u, ivB64u, tagB64u)).toThrow();
  });

  it('detects tampering: modified tag or ciphertext throws', async () => {
    const { encryptSecret, decryptSecret } = await importWithKey('key-tamper');

    const { encB64u, ivB64u, tagB64u } = encryptSecret('super-secret');

    const tamperedTag = tagB64u.slice(0, -2) + (tagB64u.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => decryptSecret(encB64u, ivB64u, tamperedTag)).toThrow();

    const encBuf = Buffer.from(encB64u, 'base64url');
    encBuf[0] = encBuf[0]! ^ 0xff;
    const tamperedEnc = Buffer.from(encBuf).toString('base64url');
    expect(() => decryptSecret(tamperedEnc, ivB64u, tagB64u)).toThrow();
  });
});
