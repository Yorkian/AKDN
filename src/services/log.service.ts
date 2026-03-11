import { getDb } from '../db/connection';

export interface LogEntry {
  strategy_id: string;
  provider_id: string;
  api_key_id: string;
  model?: string;
  request_path?: string;
  status_code?: number;
  provider_prompt_tokens?: number;
  provider_completion_tokens?: number;
  provider_total_tokens?: number;
  estimated_prompt_tokens?: number;
  estimated_completion_tokens?: number;
  estimated_total_tokens?: number;
  client_ip?: string;
  client_country?: string;
  latency_ms?: number;
  is_fallback?: number;
  error_message?: string;
}

export function insertLog(entry: LogEntry): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO logs (strategy_id, provider_id, api_key_id, model, request_path,
      status_code, provider_prompt_tokens, provider_completion_tokens, provider_total_tokens,
      estimated_prompt_tokens, estimated_completion_tokens, estimated_total_tokens,
      client_ip, client_country, latency_ms, is_fallback, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.strategy_id, entry.provider_id, entry.api_key_id,
    entry.model || null, entry.request_path || null,
    entry.status_code || null,
    entry.provider_prompt_tokens || 0, entry.provider_completion_tokens || 0, entry.provider_total_tokens || 0,
    entry.estimated_prompt_tokens || 0, entry.estimated_completion_tokens || 0, entry.estimated_total_tokens || 0,
    entry.client_ip || null, entry.client_country || null,
    entry.latency_ms || null,
    entry.is_fallback || 0, entry.error_message || null,
  );
  return result.lastInsertRowid as number;
}

export function updateLogCountry(logId: number, country: string): void {
  const db = getDb();
  db.prepare('UPDATE logs SET client_country = ? WHERE id = ?').run(country, logId);
}

export function queryLogs(filters: {
  provider_id?: string;
  strategy_id?: string;
  country?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}): { logs: any[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const values: any[] = [];

  if (filters.provider_id) { conditions.push('l.provider_id = ?'); values.push(filters.provider_id); }
  if (filters.strategy_id) { conditions.push('l.strategy_id = ?'); values.push(filters.strategy_id); }
  if (filters.country) { conditions.push('l.client_country = ?'); values.push(filters.country); }
  if (filters.start_date) { conditions.push('l.created_at >= ?'); values.push(filters.start_date); }
  if (filters.end_date) { conditions.push('l.created_at <= ?'); values.push(filters.end_date); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = ((filters.page || 1) - 1) * limit;

  const total = (db.prepare(`SELECT COUNT(*) as count FROM logs l ${where}`).get(...values) as any).count;

  const logs = db.prepare(`
    SELECT l.*, p.name as provider_name, s.name as strategy_name
    FROM logs l
    LEFT JOIN providers p ON p.id = l.provider_id
    LEFT JOIN strategies s ON s.id = l.strategy_id
    ${where}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...values, limit, offset);

  return { logs, total };
}

export function getLogStats(range: '24h' | '7d' = '24h'): any {
  const db = getDb();
  const since = range === '24h' ? "datetime('now', '-1 day')" : "datetime('now', '-7 days')";

  const totalRequests = (db.prepare(`SELECT COUNT(*) as count FROM logs WHERE created_at >= ${since}`).get() as any).count;
  const successRequests = (db.prepare(`SELECT COUNT(*) as count FROM logs WHERE created_at >= ${since} AND status_code >= 200 AND status_code < 300`).get() as any).count;
  const failedRequests = totalRequests - successRequests;

  const tokenStats = db.prepare(`
    SELECT
      SUM(CASE WHEN provider_total_tokens > 0 THEN provider_total_tokens ELSE estimated_total_tokens END) as total_tokens,
      SUM(CASE WHEN provider_prompt_tokens > 0 THEN provider_prompt_tokens ELSE estimated_prompt_tokens END) as prompt_tokens,
      SUM(CASE WHEN provider_completion_tokens > 0 THEN provider_completion_tokens ELSE estimated_completion_tokens END) as completion_tokens
    FROM logs WHERE created_at >= ${since}
  `).get() as any;

  return {
    totalRequests,
    successRequests,
    failedRequests,
    errorRate: totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(1) : '0',
    totalTokens: tokenStats.total_tokens || 0,
    promptTokens: tokenStats.prompt_tokens || 0,
    completionTokens: tokenStats.completion_tokens || 0,
  };
}
