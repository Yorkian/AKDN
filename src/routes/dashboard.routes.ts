import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import * as dashboardService from '../services/dashboard.service';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/dashboard/overview', async () => {
    return dashboardService.getOverview();
  });

  app.get('/api/dashboard/token-chart', async (request) => {
    const { range } = request.query as any;
    return dashboardService.getTokenChart(range === '7d' ? '7d' : '24h');
  });

  app.get('/api/dashboard/request-chart', async (request) => {
    const { range } = request.query as any;
    return dashboardService.getRequestChart(range === '7d' ? '7d' : '24h');
  });

  app.get('/api/dashboard/health', async () => {
    return dashboardService.getHealthRanking();
  });

  app.get('/api/dashboard/fault-pool', async () => {
    return dashboardService.getFaultPoolDashboard();
  });

  app.get('/api/dashboard/geo', async () => {
    return dashboardService.getGeoDistribution();
  });

  app.get('/api/dashboard/recent', async (request) => {
    const { limit } = request.query as any;
    return dashboardService.getRecentRequests(limit ? parseInt(limit) : 20);
  });
}
