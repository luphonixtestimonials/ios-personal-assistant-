import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}


const sanitizeEnvValue = (val: unknown) => {
  if (typeof val !== 'string') return val;
  return val
    .replace(/[\r\n]|\\[rn]/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
};

const envSchema = z.object({
  PORT: z.preprocess(sanitizeEnvValue, z.string().default('3000').transform((val) => parseInt(val, 10))),
  NODE_ENV: z.preprocess(sanitizeEnvValue, z.enum(['development', 'production', 'test']).default('development')),
  TURSO_DATABASE_URL: z.preprocess(sanitizeEnvValue, z.string().default('file:./dev.db')),
  TURSO_AUTH_TOKEN: z.preprocess(sanitizeEnvValue, z.string().optional().default('')),
  JWT_SECRET: z.preprocess(sanitizeEnvValue, z.string().min(16, 'JWT_SECRET must be at least 16 characters long').default('super-secret-synvy-jwt-key-dev-only-32-chars-long')),
  JWT_EXPIRES_IN: z.preprocess(sanitizeEnvValue, z.string().default('30d')),
  ALLOWED_ORIGIN: z.preprocess(sanitizeEnvValue, z.string().default('*')),
  VAPID_PUBLIC_KEY: z.preprocess(sanitizeEnvValue, z.string().default('BOboWTdA0w-wVfxtzPJ0J8TgHUIL2uU0P66wqeuaQGFTr_lClHcFw4VxjR7uk8HtLfY7mYDDZsDCCRSrSSKy_IU')),
  VAPID_PRIVATE_KEY: z.preprocess(sanitizeEnvValue, z.string().default('Rl8MaT7gssHdBfcldTrZoghcuXZAyHSQi9gkWhTk8Zk')),
  VAPID_SUBJECT: z.preprocess(sanitizeEnvValue, z.string().default('mailto:support@synvy.app')),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const config = parsedEnv.data;
