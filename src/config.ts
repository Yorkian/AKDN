import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

function getEnv(key: string, fallback?: string): string {
  const val = process.env[key] || fallback;
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : fallback;
}

// Auto-generate secrets if not provided (first run convenience)
function ensureSecret(key: string): string {
  const val = process.env[key];
  if (val && val.length > 0) return val;
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn(`⚠️  ${key} not set, auto-generated for this session. Set it in .env for persistence.`);
  return generated;
}

export const config = {
  port: getEnvInt('PORT', 3060),
  host: getEnv('HOST', '0.0.0.0'),
  dbPath: getEnv('DB_PATH', './data/akdn.db'),
  encryptionKey: ensureSecret('AKDN_ENCRYPTION_KEY'),
  jwtSecret: ensureSecret('JWT_SECRET'),
  ipinfoToken: process.env.IPINFO_TOKEN || '',
  firstTokenTimeout: getEnvInt('FIRST_TOKEN_TIMEOUT', 15000),
  nonStreamTimeout: getEnvInt('NON_STREAM_TIMEOUT', 30000),
  healthCheckInterval: getEnvInt('HEALTH_CHECK_INTERVAL', 60000),
  geoCacheTtl: getEnvInt('GEO_CACHE_TTL', 604800000),
};
