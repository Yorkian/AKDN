import initSqlJs from 'sql.js';
type SqlJsDatabase = any;
import path from 'path';
import fs from 'fs';
import { config } from '../config';

let db: SqlJsDatabase | null = null;
let saveTimer: NodeJS.Timeout | null = null;

// Wrapper to provide a simpler API similar to better-sqlite3
export class DbWrapper {
  private db: SqlJsDatabase;

  constructor(sqlDb: SqlJsDatabase) {
    this.db = sqlDb;
  }

  prepare(sql: string) {
    const self = this;
    return {
      run(...params: any[]) {
        self.db.run(sql, params);
        scheduleSave();
        return { lastInsertRowid: self._lastInsertRowid(), changes: self.db.getRowsModified() };
      },
      get(...params: any[]) {
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const row: any = {};
          cols.forEach((c: string, i: number) => row[c] = vals[i]);
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params: any[]) {
        const stmt = self.db.prepare(sql);
        stmt.bind(params);
        const rows: any[] = [];
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const row: any = {};
          cols.forEach((c: string, i: number) => row[c] = vals[i]);
          rows.push(row);
        }
        stmt.free();
        return rows;
      },
    };
  }

  exec(sql: string) {
    this.db.run(sql);
    scheduleSave();
  }

  transaction(fn: () => void) {
    return () => {
      this.db.run('BEGIN TRANSACTION');
      try {
        fn();
        this.db.run('COMMIT');
        scheduleSave();
      } catch (err) {
        this.db.run('ROLLBACK');
        throw err;
      }
    };
  }

  _lastInsertRowid(): number {
    const stmt = this.db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const id = stmt.get()[0] as number;
    stmt.free();
    return id;
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(config.dbPath, buffer);
  }
}

let wrapper: DbWrapper | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { wrapper?.save(); } catch (err) { console.error('DB save error:', err); }
  }, 1000);
}

export function getDb(): DbWrapper {
  if (!wrapper) throw new Error('Database not initialized. Call initDb() first.');
  return wrapper;
}

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  if (fs.existsSync(config.dbPath)) {
    const buffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  wrapper = new DbWrapper(db);

  // Enable WAL-like behavior and foreign keys
  wrapper.exec('PRAGMA foreign_keys = ON');

  // Create tables
  wrapper.exec(`
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
      status TEXT DEFAULT 'normal',
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
      mode TEXT NOT NULL,
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
      strategy_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      priority INTEGER NOT NULL,
      UNIQUE(strategy_id, provider_id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL UNIQUE,
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
  `);

  // Create indexes (ignore if exist)
  try { wrapper.exec('CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)'); } catch {}
  try { wrapper.exec('CREATE INDEX IF NOT EXISTS idx_logs_strategy_id ON logs(strategy_id)'); } catch {}
  try { wrapper.exec('CREATE INDEX IF NOT EXISTS idx_logs_provider_id ON logs(provider_id)'); } catch {}
  try { wrapper.exec('CREATE INDEX IF NOT EXISTS idx_logs_client_country ON logs(client_country)'); } catch {}

  // Migrations for existing databases
  try { wrapper.exec("ALTER TABLE providers ADD COLUMN proxy_url TEXT DEFAULT ''"); } catch {}
  try { wrapper.exec("ALTER TABLE providers ADD COLUMN health_reset_at TEXT DEFAULT ''"); } catch {}
  // Backfill NULL/empty health_reset_at with created_at
  try { wrapper.exec("UPDATE providers SET health_reset_at = created_at WHERE health_reset_at IS NULL OR health_reset_at = ''"); } catch {}
  try { wrapper.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"); } catch {}

  // Default settings
  try {
    wrapper.exec(`
      INSERT OR IGNORE INTO settings (key, value) VALUES ('first_token_timeout', '15000');
      INSERT OR IGNORE INTO settings (key, value) VALUES ('non_stream_timeout', '30000');
      INSERT OR IGNORE INTO settings (key, value) VALUES ('health_check_interval', '60000');
      INSERT OR IGNORE INTO settings (key, value) VALUES ('geo_cache_ttl', '604800000');
    `);
  } catch {}

  // Save initial state
  wrapper.save();
  console.log('✅ Database initialized');
}

export function isFirstRun(): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM admin').get() as any;
  return !row || row.count === 0;
}
