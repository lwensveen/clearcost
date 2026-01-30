import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, captcha, emailOTP, haveIBeenPwned, magicLink, username } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { Redis } from '@upstash/redis';
import {
  accountsTable,
  passkeysTable,
  sessionsTable,
  usersTable,
  verificationsTable,
} from '@clearcost/db';
import { getDb } from './schema';
import { requireEnvStrict } from './lib/env';

type AuthInstance = ReturnType<typeof betterAuth>;

let authInstance: AuthInstance | null = null;

function getEnv() {
  return {
    redisUrl: requireEnvStrict('REDIS_URL'),
    redisToken: requireEnvStrict('REDIS_TOKEN'),
    betterAuthUrl: requireEnvStrict('BETTER_AUTH_URL'),
    betterAuthSecret: requireEnvStrict('BETTER_AUTH_SECRET'),
    apiUrl: requireEnvStrict('API_URL'),
    emailOtpApiSecret: requireEnvStrict('EMAIL_OTP_API_SECRET'),
    turnstileSecretKey: requireEnvStrict('TURNSTILE_SECRET_KEY'),
  };
}

export function getAuth(): AuthInstance {
  if (authInstance) return authInstance;

  const {
    redisUrl,
    redisToken,
    betterAuthUrl,
    betterAuthSecret,
    apiUrl,
    emailOtpApiSecret,
    turnstileSecretKey,
  } = getEnv();

  const upstash = new Redis({ url: redisUrl, token: redisToken });

  const tryRedis = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      console.error('Redis error:', err);
      return null;
    }
  };

  const sendMail = async (path: string, body: unknown) => {
    await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-email-otp-secret': emailOtpApiSecret,
      },
      body: JSON.stringify(body),
    });
  };

  authInstance = betterAuth({
    secret: betterAuthSecret,
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: {
        account: accountsTable,
        passkey: passkeysTable,
        session: sessionsTable,
        user: usersTable,
        verification: verificationsTable,
      },
    }),
    trustedOrigins: [betterAuthUrl],
    secondaryStorage: {
      get: async (k) =>
        tryRedis(async () => {
          const v = await upstash.get(k);
          return v === null ? null : typeof v === 'string' ? v : JSON.stringify(v);
        }),
      set: async (k, v, ttl) =>
        tryRedis(() => (ttl ? upstash.set(k, v, { ex: ttl }) : upstash.set(k, v))),
      delete: async (key) => {
        await tryRedis(() => upstash.del(key));
      },
    },
    advanced: {
      database: { generateId: false },
      crossSubDomainCookies: {
        enabled: true,
        domain: 'containo.com',
        // additionalCookies: ['custom_cookie'],
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'facebook'],
      },
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailVerification: async ({ user, newEmail, url }) => {
          await fetch(`${apiUrl}/api/change-email-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-email-otp-secret': emailOtpApiSecret,
            },
            body: JSON.stringify({ email: user.email, newEmail, url }),
          });
        },
      },
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({ user, url, token }) => {
          await fetch(`${apiUrl}/api/delete-account-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-email-otp-secret': emailOtpApiSecret,
            },
            body: JSON.stringify({ email: user.email, url, token }),
          });
        },
        beforeDelete: async () => {},
        afterDelete: async () => {},
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      sendResetPassword: async ({ user, url, token }) => {
        await fetch(`${apiUrl}/api/magic-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-email-otp-secret': emailOtpApiSecret,
          },
          body: JSON.stringify({
            email: user.email,
            url,
            token,
            type: 'reset-password',
          }),
        });
      },
      resetPasswordTokenExpiresIn: 3600,
    },
    plugins: [
      admin(),
      haveIBeenPwned(),
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: turnstileSecretKey,
      }),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        sendVerificationOTP: async ({ email, otp, type }) => {
          await sendMail('/api/email-otp', { email, otp, type });
        },
        sendVerificationOnSignUp: false,
      }),
      magicLink({
        sendMagicLink: async ({ email, token, url }) => {
          await sendMail('/api/magic-link', { email, token, url });
        },
        expiresIn: 900,
      }),
      username(),
      nextCookies(),
    ],
  });

  return authInstance;
}
