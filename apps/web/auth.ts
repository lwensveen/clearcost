import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, captcha, emailOTP, haveIBeenPwned, magicLink, username } from 'better-auth/plugins';
import { passkey } from 'better-auth/plugins/passkey';
import { nextCookies } from 'better-auth/next-js';
import { db } from './schema';
import { Redis } from '@upstash/redis';
import {
  accountsTable,
  passkeysTable,
  sessionsTable,
  usersTable,
  verificationsTable,
} from '@clearcost/db';

const upstash = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
});

export const auth: any = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      account: accountsTable,
      passkey: passkeysTable,
      session: sessionsTable,
      user: usersTable,
      verification: verificationsTable,
    },
  }),
  trustedOrigins: [process.env.BETTER_AUTH_URL!],
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
        await fetch(`${process.env.API_URL}/api/change-email-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-email-otp-secret': process.env.EMAIL_OTP_API_SECRET as string,
          },
          body: JSON.stringify({ email: user.email, url }),
        });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }) => {
        await fetch(`${process.env.API_URL}/api/delete-account-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-email-otp-secret': process.env.EMAIL_OTP_API_SECRET as string,
          },
          body: JSON.stringify({ email: user.email, url }),
        });
      },
      beforeDelete: async (user) => {},
      afterDelete: async (user) => {},
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
      await fetch(`${process.env.API_URL}/api/magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-email-otp-secret': process.env.EMAIL_OTP_API_SECRET as string,
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
    passkey(),
    haveIBeenPwned(),
    captcha({
      provider: 'cloudflare-turnstile',
      secretKey: process.env.TURNSTILE_SECRET_KEY as string,
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

async function tryRedis<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error('Redis error:', err);
    return null;
  }
}

async function sendMail(path: string, body: unknown) {
  await fetch(`${process.env.API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-email-otp-secret': process.env.EMAIL_OTP_API_SECRET!,
    },
    body: JSON.stringify(body),
  });
}
