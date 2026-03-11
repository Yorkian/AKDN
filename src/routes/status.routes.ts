import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/connection';
import { getFaultPoolStatus } from '../services/fault-pool.service';

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/status', async () => {
    const db = getDb();
    const providers = db.prepare('SELECT id, name, status FROM providers').all();
    const faultPool = getFaultPoolStatus();

    return {
      providers,
      faultPool,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  });
}
