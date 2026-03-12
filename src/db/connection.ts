import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export async function initDb(): Promise<void> {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      api_type TEXT DEFAULT 'openai-completions',
      model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      prompt_token_limit INTEGER DEFAULT 0,
      completion_token_limit INTEGER DEFAULT 0,
      prompt_tokens_used INTEGER DEFAULT 0,
      completion_tokens_used INTEGER DEFAULT 0,
      proxy_url TEXT DEFAULT '',
      health_reset_at TEXT DEFAULT '',
      status TEXT DEFAULT 'normal' CHECK(status IN ('normal','fault','throttled')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('priority','round_robin')),
      prompt_token_limit INTEGER DEFAULT 0,
      completion_token_limit INTEGER DEFAULT 0,
      prompt_tokens_used INTEGER DEFAULT 0,
      completion_tokens_used INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS strategy_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id TEXT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
      provider_id TEXT NOT NULL REFERENCES providers(id),
      priority INTEGER NOT NULL,
      UNIQUE(strategy_id, provider_id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL UNIQUE REFERENCES strategies(id) ON DELETE CASCADE,
      key_value TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      api_key_id TEXT NOT NULL,
      model TEXT,
      request_path TEXT,
      status_code INTEGER,
      provider_prompt_tokens INTEGER DEFAULT 0,
      provider_completion_tokens INTEGER DEFAULT 0,
      provider_total_tokens INTEGER DEFAULT 0,
      estimated_prompt_tokens INTEGER DEFAULT 0,
      estimated_completion_tokens INTEGER DEFAULT 0,
      estimated_total_tokens INTEGER DEFAULT 0,
      client_ip TEXT,
      client_country TEXT,
      latency_ms INTEGER,
      is_fallback INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ip_geo_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_prefix TEXT NOT NULL UNIQUE,
      country TEXT NOT NULL,
      country_code TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_strategy_id ON logs(strategy_id);
    CREATE INDEX IF NOT EXISTS idx_logs_provider_id ON logs(provider_id);
    CREATE INDEX IF NOT EXISTS idx_logs_client_country ON logs(client_country);
  `);

  // Migrations for existing databases
  try { d.exec("ALTER TABLE providers ADD COLUMN proxy_url TEXT DEFAULT ''"); } catch {}
  try { d.exec("ALTER TABLE providers ADD COLUMN health_reset_at TEXT DEFAULT ''"); } catch {}
  try { d.exec("UPDATE providers SET health_reset_at = created_at WHERE health_reset_at IS NULL OR health_reset_at = ''"); } catch {}

  // Default settings
  try {
    d.exec(`
      INSERT OR IGNORE INTO settings (key, value) VALUES ('first_token_timeout', '15000');
      INSERT OR IGNORE INTO settings (key, value) VALUES ('non_stream_timeout', '30000');
      INSERT OR IGNORE INTO settings (key, value) VALUES ('health_check_interval', '60000');
      INSERT OR IGNORE INTO settings (key, value) VALUES ('geo_cache_ttl', '604800000');
    `);
  } catch {}

  console.log('✅ Database initialized');
}

export function isFirstRun(): boolean {
  const d = getDb();
  const row = d.prepare('SELECT COUNT(*) as count FROM admin').get() as any;
  return row.count === 0;
}
