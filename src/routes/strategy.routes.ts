import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import * as strategyService from '../services/strategy.service';

export async function strategyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/strategies', async () => {
    return strategyService.listStrategies();
  });

  app.get('/api/strategies/:id', async (request, reply) => {
    const { id } = request.params as any;
    const strategy = strategyService.getStrategyById(id);
    if (!strategy) return reply.code(404).send({ error: 'Strategy not found' });
    return strategy;
  });

  app.post('/api/strategies', async (request, reply) => {
    const body = request.body as any;
    if (!body.name || !body.mode || !body.provider_ids || body.provider_ids.length === 0) {
      return reply.code(400).send({ error: 'Missing required fields: name, mode, provider_ids (array)' });
    }
    if (!['priority', 'round_robin'].includes(body.mode)) {
      return reply.code(400).send({ error: 'mode must be "priority" or "round_robin"' });
    }
    const strategy = strategyService.createStrategy(body);
    return strategy;
  });

  app.put('/api/strategies/:id', async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const strategy = strategyService.updateStrategy(id, body);
    if (!strategy) return reply.code(404).send({ error: 'Strategy not found' });
    return strategy;
  });

  app.delete('/api/strategies/:id', async (request, reply) => {
    const { id } = request.params as any;
    strategyService.deleteStrategy(id);
    return { success: true };
  });

  app.post('/api/strategies/:id/reset-usage', async (request, reply) => {
    const { id } = request.params as any;
    strategyService.resetStrategyUsage(id);
    return { success: true };
  });
}
