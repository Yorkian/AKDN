import { getDb } from '../db/connection';
import { HEALTH_THRESHOLDS } from '../utils/constants';
import { getFaultPoolStatus } from './fault-pool.service';

export function getOverview() {
  const db = getDb();
  const strategies = (db.prepare('SELECT COUNT(*) as count FROM strategies').get() as any).count;
  const providers = (db.prepare('SELECT COUNT(*) as count FROM providers').get() as any).count;
  const faultCount = (db.prepare("SELECT COUNT(*) as count FROM providers WHERE status = 'fault'").get() as any).count;
  const throttledCount = (db.prepare("SELECT COUNT(*) as count FROM providers WHERE status = 'throttled'").get() as any).count;
  const todayRequests = (db.prepare("SELECT COUNT(*) as count FROM logs WHERE created_at >= date('now')").get() as any).count;
  return { strategies, providers, faultCount, throttledCount, todayRequests };
}

function getSinceISO(range: '24h' | '7d'): string {
  const now = new Date();
  if (range === '24h') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
  }
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
}

function bucketKey(dateStr: string, range: '24h' | '7d'): string {
  // dateStr is like "2026-03-11 08:23:45"
  if (range === '24h') {
    return dateStr.substring(0, 13) + ':00'; // "2026-03-11 08:00"
  }
  return dateStr.substring(0, 10); // "2026-03-11"
}

function bucketLabel(key: string, range: '24h' | '7d'): string {
  if (range === '24h') {
    return key.substring(11, 16); // "08:00"
  }
  return key.substring(5); // "03-11"
}

function generateAllBuckets(range: '24h' | '7d'): string[] {
  const buckets: string[] = [];
  const now = new Date();

  if (range === '24h') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const iso = d.toISOString().replace('T', ' ').substring(0, 19);
      buckets.push(bucketKey(iso, '24h'));
    }
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().replace('T', ' ').substring(0, 19);
      buckets.push(bucketKey(iso, '7d'));
    }
  }
  return buckets;
}

export function getTokenChart(range: '24h' | '7d') {
  const db = getDb();
  const since = getSinceISO(range);

  // Simple query — no strftime, just fetch raw rows
  const rows = db.prepare(
    'SELECT created_at, provider_total_tokens, estimated_total_tokens, provider_prompt_tokens, estimated_prompt_tokens, provider_completion_tokens, estimated_completion_tokens FROM logs WHERE created_at >= ?'
  ).all(since) as any[];

  // Aggregate in JS
  const allBuckets = generateAllBuckets(range);
  const map = new Map<string, { tokens: number; prompt: number; completion: number }>();
  for (const b of allBuckets) map.set(b, { tokens: 0, prompt: 0, completion: 0 });

  for (const r of rows) {
    if (!r.created_at) continue;
    const key = bucketKey(r.created_at, range);
    const entry = map.get(key);
    if (!entry) continue;
    entry.tokens += (r.provider_total_tokens > 0 ? r.provider_total_tokens : r.estimated_total_tokens) || 0;
    entry.prompt += (r.provider_prompt_tokens > 0 ? r.provider_prompt_tokens : r.estimated_prompt_tokens) || 0;
    entry.completion += (r.provider_completion_tokens > 0 ? r.provider_completion_tokens : r.estimated_completion_tokens) || 0;
  }

  return allBuckets.map(b => {
    const entry = map.get(b)!;
    return {
      time_bucket: b,
      label: bucketLabel(b, range),
      tokens: entry.tokens,
      prompt_tokens: entry.prompt,
      completion_tokens: entry.completion,
    };
  });
}

export function getRequestChart(range: '24h' | '7d') {
  const db = getDb();
  const since = getSinceISO(range);

  const rows = db.prepare(
    'SELECT created_at, status_code FROM logs WHERE created_at >= ?'
  ).all(since) as any[];

  const allBuckets = generateAllBuckets(range);
  const map = new Map<string, { total: number; success: number; failed: number }>();
  for (const b of allBuckets) map.set(b, { total: 0, success: 0, failed: 0 });

  for (const r of rows) {
    if (!r.created_at) continue;
    const key = bucketKey(r.created_at, range);
    const entry = map.get(key);
    if (!entry) continue;
    entry.total++;
    if (r.status_code >= 200 && r.status_code < 300) {
      entry.success++;
    } else {
      entry.failed++;
    }
  }

  return allBuckets.map(b => {
    const entry = map.get(b)!;
    return {
      time_bucket: b,
      label: bucketLabel(b, range),
      total: entry.total,
      success: entry.success,
      failed: entry.failed,
    };
  });
}

export function getHealthRanking() {
  const db = getDb();
  const since = getSinceISO('24h');

  let providers: any[];
  try {
    providers = db.prepare('SELECT id, name, status, health_reset_at FROM providers').all() as any[];
  } catch {
    // health_reset_at column might not exist in edge cases
    providers = db.prepare('SELECT id, name, status FROM providers').all() as any[];
  }

  if (providers.length === 0) return [];

  const logs = db.prepare(
    'SELECT provider_id, status_code, created_at FROM logs WHERE created_at >= ?'
  ).all(since) as any[];

  // Build reset time map — use health_reset_at if available, else epoch
  const resetMap = new Map<string, string>();
  for (const p of providers) {
    resetMap.set(p.id, p.health_reset_at || '');
  }

  // Aggregate per provider, respecting health_reset_at
  const statsMap = new Map<string, { total: number; success: number }>();
  for (const l of logs) {
    const resetAt = resetMap.get(l.provider_id) || '';
    // Skip logs before this provider's health reset
    if (resetAt && l.created_at && l.created_at < resetAt) continue;

    const s = statsMap.get(l.provider_id) || { total: 0, success: 0 };
    s.total++;
    if (l.status_code >= 200 && l.status_code < 300) s.success++;
    statsMap.set(l.provider_id, s);
  }

  const results = providers.map(p => {
    const stats = statsMap.get(p.id) || { total: 0, success: 0 };
    const availability = stats.total > 0
      ? (stats.success / stats.total) * 100
      : (p.status === 'normal' ? 100 : 0);

    let color: 'green' | 'yellow' | 'red';
    if (availability >= HEALTH_THRESHOLDS.GREEN) color = 'green';
    else if (availability >= HEALTH_THRESHOLDS.YELLOW) color = 'yellow';
    else color = 'red';

    return {
      id: p.id, name: p.name, status: p.status,
      availability: +availability.toFixed(1),
      totalRequests: stats.total,
      color,
    };
  });

  // Sort: low availability first
  results.sort((a, b) => a.availability - b.availability);
  return results.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

export function getFaultPoolDashboard() {
  const db = getDb();
  const faultProviders = getFaultPoolStatus();
  const throttledProviders = db.prepare(`
    SELECT id, name, prompt_tokens_used, prompt_token_limit,
      completion_tokens_used, completion_token_limit
    FROM providers WHERE status = 'throttled'
  `).all();
  return { faultProviders, throttledProviders };
}

export function getGeoDistribution() {
  const db = getDb();
  const rows = db.prepare(
    "SELECT client_country FROM logs WHERE client_country IS NOT NULL AND client_country != ''"
  ).all() as any[];

  // Aggregate in JS
  const countMap = new Map<string, number>();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

  const filteredRows = db.prepare(
    "SELECT client_country FROM logs WHERE created_at >= ? AND client_country IS NOT NULL AND client_country != ''"
  ).all(since) as any[];

  for (const r of filteredRows) {
    countMap.set(r.client_country, (countMap.get(r.client_country) || 0) + 1);
  }

  const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const total = sorted.reduce((s, [, c]) => s + c, 0);
  return sorted.map(([country, count]) => ({
    country, count,
    percentage: total > 0 ? +((count / total) * 100).toFixed(1) : 0,
  }));
}

export function getRecentRequests(limit: number = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT l.*, p.name as provider_name, s.name as strategy_name
    FROM logs l
    LEFT JOIN providers p ON p.id = l.provider_id
    LEFT JOIN strategies s ON s.id = l.strategy_id
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(limit);
}
