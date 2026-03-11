import { FastifyInstance } from 'fastify';
import { handleProxyRequest } from '../services/proxy.service';
import { getStrategyByKey0 } from '../services/strategy.service';

export async function proxyRoutes(app: FastifyInstance): Promise<void> {
  // Chat completions (main endpoint)
  app.post('/v1/chat/completions', async (request, reply) => {
    await handleProxyRequest(request, reply, '/chat/completions');
  });

  // Text completions
  app.post('/v1/completions', async (request, reply) => {
    await handleProxyRequest(request, reply, '/completions');
  });

  // Models listing
  app.get('/v1/models', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: { message: 'Missing Authorization header' } });
    }

    const key0 = authHeader.substring(7);
    const strategy = getStrategyByKey0(key0);
    if (!strategy) {
      return reply.code(401).send({ error: { message: 'Invalid API key' } });
    }

    const models = (strategy.providers || []).map(p => ({
      id: p.name || p.provider_id,
      object: 'model',
      owned_by: 'akdn',
    }));

    return { object: 'list', data: models };
  });
}
