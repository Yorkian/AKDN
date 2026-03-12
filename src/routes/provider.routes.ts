import { FastifyInstance } from 'fastify';
import { spawn } from 'child_process';
import { authMiddleware } from '../middleware/auth';
import * as providerService from '../services/provider.service';
import { PROVIDER_PRESETS } from '../utils/constants';

interface TestStep {
  step: string;
  status: 'ok' | 'fail' | 'skip';
  detail?: string;
  lines?: Array<{ label: string; value: string }>;
  model?: string;
  responded?: boolean;
  ms?: number;
  errorRaw?: string;
}

/**
 * Run curl via spawn. If stdinData is provided, it is piped to curl's stdin (for -d @-).
 * This avoids command-line argument issues with JSON in Docker environments.
 */
function runCurl(args: string[], stdinData?: string, timeoutMs: number = 20000): Promise<{
  stdout: string; stderr: string; exitCode: number; elapsed: number;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    let stdout = '';
    let stderr = '';
    let done = false;

    const proc = spawn('curl', args, { timeout: timeoutMs });

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (done) return;
      done = true;
      resolve({ stdout, stderr, exitCode: code ?? 1, elapsed: Date.now() - start });
    });

    proc.on('error', (err) => {
      if (done) return;
      done = true;
      resolve({ stdout, stderr: err.message, exitCode: 1, elapsed: Date.now() - start });
    });

    // Pipe body to stdin if provided
    if (stdinData) {
      proc.stdin.write(stdinData);
      proc.stdin.end();
    }
  });
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

  // Duplicate provider
  app.post('/api/providers/:id/duplicate', async (request, reply) => {
    const { id } = request.params as any;
    let source: providerService.Provider | null;
    try { source = providerService.getProviderById(id); }
    catch (err) { return reply.code(500).send({ error: (err as Error).message }); }
    if (!source) return reply.code(404).send({ error: 'Provider not found' });

    const copy = providerService.createProvider({
      name: `${source.name} - Copy`,
      base_url: source.base_url,
      api_key: source.api_key,
      api_type: source.api_type,
      model_id: source.model_id,
      proxy_url: source.proxy_url || '',
      prompt_token_limit: source.prompt_token_limit,
      completion_token_limit: source.completion_token_limit,
    });
    return { ...copy, api_key: '***masked***' };
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
      // Step 1: Proxy test
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

      // Step 2: API test — use -d @- to pipe body via stdin (avoids arg escaping issues in Docker)
      const apiUrl = `${provider.base_url}/chat/completions`;
      const requestBody = JSON.stringify({ model: provider.model_id, messages: [{ role: 'user', content: 'Say 1' }], max_tokens: 10, stream: false });

      const curlArgs: string[] = [];
      if (proxyUrl) curlArgs.push('--proxy', proxyUrl);
      curlArgs.push(
        '--max-time', '20',
        '-s',
        '-w', '\n__HTTP_CODE__%{http_code}',
        '-X', 'POST',
        '-H', `Authorization: Bearer ${provider.api_key}`,
        '-H', 'Content-Type: application/json',
        '-d', '@-',   // read body from stdin
        apiUrl,
      );

      const apiResult = await runCurl(curlArgs, requestBody);
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
