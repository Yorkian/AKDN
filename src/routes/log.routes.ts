import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import * as logService from '../services/log.service';

export async function logRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/logs', async (request) => {
    const query = request.query as any;
    return logService.queryLogs({
      provider_id: query.provider_id,
      strategy_id: query.strategy_id,
      country: query.country,
      start_date: query.start_date,
      end_date: query.end_date,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 50,
    });
  });

  app.get('/api/logs/stats', async (request) => {
    const { range } = request.query as any;
    return logService.getLogStats(range === '7d' ? '7d' : '24h');
  });
}
