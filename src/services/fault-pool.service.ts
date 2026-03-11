import { getDb } from '../db/connection';
import { config } from '../config';
import { decrypt } from '../db/encrypt';
import { proxyFetch } from '../utils/proxy-fetch';

interface FaultEntry {
  since: number;
  retryCount: number;
}

// In-memory fault tracking (supplementary to DB status field)
const faultPool = new Map<string, FaultEntry>();
let healthCheckTimer: NodeJS.Timeout | null = null;

export function addToFaultPool(providerId: string): void {
  const db = getDb();
  faultPool.set(providerId, {
    since: Date.now(),
    retryCount: 0,
  });
  db.prepare("UPDATE providers SET status = 'fault', updated_at = datetime('now') WHERE id = ? AND status = 'normal'")
    .run(providerId);
}

export function removeFromFaultPool(providerId: string): void {
  faultPool.delete(providerId);
  const db = getDb();
  db.prepare("UPDATE providers SET status = 'normal', updated_at = datetime('now') WHERE id = ? AND status = 'fault'")
    .run(providerId);
}

export function getFaultPoolStatus(): Array<{ providerId: string; name: string; since: number; retryCount: number; nextCheck: number }> {
  const db = getDb();
  const results: any[] = [];

  for (const [providerId, entry] of faultPool.entries()) {
    const provider = db.prepare('SELECT name FROM providers WHERE id = ?').get(providerId) as any;
    const elapsed = Date.now() - entry.since;
    const nextCheck = Math.max(0, config.healthCheckInterval - (elapsed % config.healthCheckInterval));

    results.push({
      providerId,
      name: provider?.name || 'Unknown',
      since: entry.since,
      retryCount: entry.retryCount,
      nextCheck: Math.round(nextCheck / 1000),
    });
  }

  return results;
}

async function runHealthChecks(): Promise<void> {
  const db = getDb();
  const faultProviders = db.prepare("SELECT id, base_url, api_key, model_id, proxy_url FROM providers WHERE status = 'fault'").all() as any[];

  for (const provider of faultProviders) {
    try {
      const apiKey = decrypt(provider.api_key);
      const url = `${provider.base_url}/chat/completions`;

      const res = await proxyFetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model_id,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
          stream: false,
        }),
        signal: AbortSignal.timeout(10000),
      }, provider.proxy_url || undefined);

      if (res.ok) {
        console.log(`✅ Provider ${provider.id} recovered`);
        removeFromFaultPool(provider.id);
      } else {
        const entry = faultPool.get(provider.id);
        if (entry) entry.retryCount++;
        console.log(`❌ Provider ${provider.id} still down (HTTP ${res.status})`);
      }
    } catch (err) {
      const entry = faultPool.get(provider.id);
      if (entry) entry.retryCount++;
      console.log(`❌ Provider ${provider.id} health check failed:`, (err as Error).message);
    }
  }
}

export function startHealthChecks(): void {
  if (healthCheckTimer) return;

  // Sync DB status to in-memory pool on startup
  const db = getDb();
  const faults = db.prepare("SELECT id FROM providers WHERE status = 'fault'").all() as any[];
  for (const f of faults) {
    if (!faultPool.has(f.id)) {
      faultPool.set(f.id, { since: Date.now(), retryCount: 0 });
    }
  }

  healthCheckTimer = setInterval(runHealthChecks, config.healthCheckInterval);
  console.log(`🏥 Health checks started (every ${config.healthCheckInterval / 1000}s)`);
}

export function stopHealthChecks(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}
