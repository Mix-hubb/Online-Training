// Typed env config. Fails fast on missing required values in production.
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  COOKIE_DOMAIN: z.string().optional().default(''),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),

  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().default('Online Training <no-reply@example.com>'),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  /** Local only: mark orders paid without Stripe when no key is set. Never in production. */
  DEV_FAKE_PAYMENTS: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v === 'true'),

  BUNNY_STREAM_LIBRARY_ID: z.string().optional().default(''),
  BUNNY_STREAM_API_KEY: z.string().optional().default(''),
  BUNNY_STREAM_TOKEN_KEY: z.string().optional().default(''),
  BUNNY_CDN_HOSTNAME: z.string().optional().default(''),

  BUNNY_STORAGE_ZONE: z.string().optional().default(''),
  BUNNY_STORAGE_KEY: z.string().optional().default(''),
  BUNNY_STORAGE_HOST: z.string().optional().default('storage.bunnycdn.com'),
  BUNNY_STORAGE_CDN_URL: z.string().optional().default(''),
  /** Second storage zone for private files (payment slips, chat photos). It has NO pull zone: the api reads it. */
  BUNNY_STORAGE_PRIVATE_ZONE: z.string().optional().default(''),
  BUNNY_STORAGE_PRIVATE_KEY: z.string().optional().default(''),

  UPLOAD_DIR: z.string().default('uploads'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/** "x.b-cdn.net/" -> "https://x.b-cdn.net" */
const origin = (v: string) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`).replace(/\/+$/, '') : '');
const host = (v: string) => v.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

const BUNNY_STORAGE_VARS = ['BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_KEY', 'BUNNY_STORAGE_CDN_URL', 'BUNNY_STORAGE_PRIVATE_ZONE', 'BUNNY_STORAGE_PRIVATE_KEY'] as const;
const BUNNY_STREAM_VARS = ['BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_API_KEY', 'BUNNY_STREAM_TOKEN_KEY', 'BUNNY_CDN_HOSTNAME'] as const;
// Half a Bunny setup would silently fall back to local disk / the dev player: refuse to start instead.
for (const group of [BUNNY_STORAGE_VARS, BUNNY_STREAM_VARS]) {
  const missing = group.filter((k) => !parsed.data[k]);
  if (missing.length && missing.length < group.length) {
    console.error(`Invalid environment: Bunny is partly set up. Also set: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const config = {
  ...parsed.data,
  BUNNY_STORAGE_CDN_URL: origin(parsed.data.BUNNY_STORAGE_CDN_URL),
  BUNNY_STORAGE_HOST: host(parsed.data.BUNNY_STORAGE_HOST),
  BUNNY_CDN_HOSTNAME: host(parsed.data.BUNNY_CDN_HOSTNAME),
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  stripeEnabled: Boolean(parsed.data.STRIPE_SECRET_KEY),
  bunnyStreamEnabled: BUNNY_STREAM_VARS.every((k) => parsed.data[k]),
  bunnyStorageEnabled: BUNNY_STORAGE_VARS.every((k) => parsed.data[k]),
};

if (config.isProd && config.DEV_FAKE_PAYMENTS) {
  // Safety: never fake payments in production.
  (config as { DEV_FAKE_PAYMENTS: boolean }).DEV_FAKE_PAYMENTS = false;
}
