import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { config } from './config';
import { initDb } from './db/connection';
import { authRoutes } from './routes/auth.routes';
import { providerRoutes } from './routes/provider.routes';
import { strategyRoutes } from './routes/strategy.routes';
import { logRoutes } from './routes/log.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { statusRoutes } from './routes/status.routes';
import { settingsRoutes } from './routes/settings.routes';
import { proxyRoutes } from './routes/proxy.routes';
import { startHealthChecks } from './services/fault-pool.service';

async function main() {
  // Initialize database
  await initDb();

  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB for large prompts
    trustProxy: true,
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Serve frontend static files
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  try {
    await app.register(fastifyStatic, {
      root: frontendPath,
      prefix: '/',
      wildcard: false,
    });
  } catch {
    console.log('ℹ️  Frontend dist not found, API-only mode');
  }

  // Content type parser for proxy (raw body needed)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const str = (body as string || '').trim();
      const json = str ? JSON.parse(str) : {};
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Register routes
  await app.register(authRoutes);
  await app.register(providerRoutes);
  await app.register(strategyRoutes);
  await app.register(logRoutes);
  await app.register(dashboardRoutes);
  await app.register(statusRoutes);
  await app.register(settingsRoutes);
  await app.register(proxyRoutes);

  // SPA fallback - serve index.html for non-API routes
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/v1/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    try {
      return reply.sendFile('index.html');
    } catch {
      return reply.code(404).send({ error: 'Not found' });
    }
  });

  // Start health checks
  startHealthChecks();

  // Start server
  await app.listen({ port: config.port, host: config.host });
  console.log(`
╔════════════════════════════════════════════╗
║          AKDN - AI API Key                ║
║          Delivery Network                 ║
║                                           ║
║  🌐 http://${config.host}:${config.port}              ║
║  📊 Dashboard: http://localhost:${config.port}     ║
╚════════════════════════════════════════════╝
  `);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
