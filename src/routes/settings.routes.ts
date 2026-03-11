import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/connection';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // Get all settings
  app.get('/api/settings', async () => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return settings;
  });

  // Update settings
  app.put('/api/settings', async (request) => {
    const db = getDb();
    const body = request.body as Record<string, any>;

    const allowedKeys = [
      'first_token_timeout', 'non_stream_timeout',
      'health_check_interval', 'geo_cache_ttl',
    ];

    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.includes(key)) continue;
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    }

    return { success: true };
  });

  // Clear all logs
  app.post('/api/settings/clear-logs', async () => {
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as count FROM logs').get() as any).count;
    db.prepare('DELETE FROM logs').run();
    return { success: true, deletedCount: count };
  });

  // Clear GeoIP cache
  app.post('/api/settings/clear-geo-cache', async () => {
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as count FROM ip_geo_cache').get() as any).count;
    db.prepare('DELETE FROM ip_geo_cache').run();
    return { success: true, deletedCount: count };
  });

  // System stats
  app.get('/api/settings/stats', async () => {
    const db = getDb();
    const logCount = (db.prepare('SELECT COUNT(*) as count FROM logs').get() as any).count;
    const geoCacheCount = (db.prepare('SELECT COUNT(*) as count FROM ip_geo_cache').get() as any).count;
    const providerCount = (db.prepare('SELECT COUNT(*) as count FROM providers').get() as any).count;
    const strategyCount = (db.prepare('SELECT COUNT(*) as count FROM strategies').get() as any).count;

    return {
      logCount,
      geoCacheCount,
      providerCount,
      strategyCount,
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
  });
}
