import { FastifyInstance } from 'fastify';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { authMiddleware } from '../middleware/auth';
import * as providerService from '../services/provider.service';
import { PROVIDER_PRESETS } from '../utils/constants';

const execFileAsync = promisify(execFile);

interface TestStep {
  step: string;   // i18n key: 'proxy_test' | 'api_test'
  status: 'ok' | 'fail' | 'skip';
  detail?: string;
  lines?: Array<{ label: string; value: string }>;
  model?: string;
  responded?: boolean; // API returned a valid response
  ms?: number;
  errorRaw?: string;   // raw error for display
}

async function runCurl(args: string[], timeoutMs: number = 20000): Promise<{
  stdout: string; stderr: string; exitCode: number; elapsed: number;
}> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync('curl', args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    return { stdout, stderr, exitCode: 0, elapsed: Date.now() - start };
  } catch (err: any) {
    return { stdout: err.stdout || '', stderr: err.stderr || err.message || '', exitCode: err.code === 'ETIMEDOUT' ? -1 : (err.status || 1), elapsed: Date.now() - start };
  }
}

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/providers', async () => providerService.listProviders());
  app.get('/api/providers/presets', async () => PROVIDER_PRESETS);

  app.post('/api/providers', async (request, reply) => {
    const body = request.body as any;
    if (!body.name || !body.base_url || !body.api_key || !body.model_id)
      return reply.code(400).send({ error: 'Missing required fields' });
    const provider = providerService.createProvider(body);
    return { ...provider, api_key: '***masked***' };
  });

  app.put('/api/providers/:id', async (request, reply) => {
    const { id } = request.params as any;
    const provider = providerService.updateProvider(id, request.body as any);
    if (!provider) return reply.code(404).send({ error: 'Provider not found' });
    return { ...provider, api_key: '***masked***' };
  });

  app.delete('/api/providers/:id', async (request, reply) => {
    const { id } = request.params as any;
    const result = providerService.deleteProvider(id);
    if (!result.success) return reply.code(409).send({ error: result.error });
    return { success: true };
  });

  // Test provider connectivity
  app.post('/api/providers/:id/test', async (request, reply) => {
    const { id } = request.params as any;
    let provider: providerService.Provider | null;
    try { provider = providerService.getProviderById(id); }
    catch (err) { return reply.code(500).send({ success: false, steps: [{ step: 'error', status: 'fail', errorRaw: (err as Error).message }] }); }
    if (!provider) return reply.code(404).send({ success: false, steps: [{ step: 'error', status: 'fail', errorRaw: 'Not found' }] });

    const steps: TestStep[] = [];
    const proxyUrl = provider.proxy_url || '';

    try {
      // Step 1: Proxy
      if (proxyUrl) {
        const proxyResult = await runCurl([
          '--proxy', proxyUrl, '--max-time', '10', '-s',
          'http://ip-api.com/json/?fields=query,isp,org,status',
        ]);

        if (proxyResult.exitCode === 0 && proxyResult.stdout.trim()) {
          try {
            const data = JSON.parse(proxyResult.stdout.trim());
            if (data.status === 'success') {
              steps.push({
                step: 'proxy_test', status: 'ok',
                lines: [
                  { label: 'ip', value: data.query || 'unknown' },
                  { label: 'isp', value: data.isp || data.org || 'unknown' },
                ],
                ms: proxyResult.elapsed,
              });
            } else {
              steps.push({ step: 'proxy_test', status: 'fail', errorRaw: proxyResult.stdout.substring(0, 200), ms: proxyResult.elapsed });
              return { success: false, steps };
            }
          } catch {
            const exitIp = proxyResult.stdout.trim().split('\n')[0].trim();
            steps.push({ step: 'proxy_test', status: 'ok', lines: [{ label: 'ip', value: exitIp }], ms: proxyResult.elapsed });
          }
        } else {
          steps.push({ step: 'proxy_test', status: 'fail', errorRaw: proxyResult.stderr.substring(0, 300) || 'curl exit ' + proxyResult.exitCode, ms: proxyResult.elapsed });
          return { success: false, steps };
        }
      } else {
        steps.push({ step: 'proxy_test', status: 'skip' });
      }

      // Step 2: API
      const apiUrl = `${provider.base_url}/chat/completions`;
      const requestBody = JSON.stringify({ model: provider.model_id, messages: [{ role: 'user', content: 'Say 1' }], max_tokens: 10, stream: false });
      const curlArgs: string[] = [];
      if (proxyUrl) curlArgs.push('--proxy', proxyUrl);
      curlArgs.push('--max-time', '20', '-s', '-w', '\n__HTTP_CODE__%{http_code}', '-X', 'POST',
        '-H', `Authorization: Bearer ${provider.api_key}`, '-H', 'Content-Type: application/json', '-d', requestBody, apiUrl);

      const apiResult = await runCurl(curlArgs);
      const outputLines = apiResult.stdout.split('__HTTP_CODE__');
      const responseBody = outputLines[0].trim();
      const httpCode = parseInt(outputLines[1]?.trim() || '0', 10);

      if (apiResult.exitCode !== 0 && httpCode === 0) {
        steps.push({ step: 'api_test', status: 'fail', errorRaw: apiResult.stderr.substring(0, 300) || 'curl exit ' + apiResult.exitCode, ms: apiResult.elapsed });
        return { success: false, steps };
      }

      if (httpCode >= 200 && httpCode < 300) {
        let model = provider.model_id;
        let responded = false;
        try {
          const data = JSON.parse(responseBody);
          model = data.model || provider.model_id;
          responded = !!(data.choices?.[0]?.message?.content);
        } catch {}
        steps.push({ step: 'api_test', status: 'ok', model, responded, ms: apiResult.elapsed });
        return { success: true, steps };
      } else {
        steps.push({ step: 'api_test', status: 'fail', errorRaw: `HTTP ${httpCode}: ${responseBody.substring(0, 300)}`, ms: apiResult.elapsed });
        return { success: false, steps };
      }
    } catch (err) {
      steps.push({ step: 'error', status: 'fail', errorRaw: (err as Error).message });
      return { success: false, steps };
    }
  });

  app.post('/api/providers/:id/reset-usage', async (request, reply) => {
    const { id } = request.params as any;
    providerService.resetProviderUsage(id);
    return { success: true };
  });
}
