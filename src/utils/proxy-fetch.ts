import { ProxyAgent, fetch as undiciFetch, Agent } from 'undici';
import { SocksClient } from 'socks';
import tls from 'tls';
import net from 'net';

function createSocksDispatcher(proxyUrl: string): Agent {
  const parsed = new URL(proxyUrl);
  const proxyType = proxyUrl.startsWith('socks5') ? 5 : 4;

  return new Agent({
    connect: async (opts: any, cb: any) => {
      try {
        const destPort = opts.port ? parseInt(String(opts.port)) : 443;
        const { socket } = await SocksClient.createConnection({
          proxy: {
            host: parsed.hostname,
            port: parseInt(parsed.port) || 1080,
            type: proxyType,
            userId: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
          },
          destination: {
            host: opts.hostname || opts.host || 'localhost',
            port: destPort,
          },
          command: 'connect',
          timeout: 10000,
        });

        // If target is HTTPS, wrap socket with TLS
        if (destPort === 443 || opts.protocol === 'https:') {
          const tlsSocket = tls.connect({
            socket: socket as net.Socket,
            servername: opts.hostname || opts.host,
          });
          tlsSocket.on('secureConnect', () => cb(null, tlsSocket));
          tlsSocket.on('error', (err: Error) => cb(err, null));
        } else {
          cb(null, socket);
        }
      } catch (err) {
        cb(err as Error, null);
      }
    },
  });
}

/**
 * Fetch with optional proxy support
 * @param url Target URL
 * @param options Fetch options (method, headers, body, signal)
 * @param proxyUrl Optional proxy URL (http:// or socks5://)
 */
export async function proxyFetch(
  url: string,
  options: any,
  proxyUrl?: string,
): Promise<Response> {
  if (!proxyUrl) {
    return fetch(url, options);
  }

  let dispatcher: any;

  if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
    dispatcher = new ProxyAgent(proxyUrl);
  } else if (proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks4://')) {
    dispatcher = createSocksDispatcher(proxyUrl);
  } else {
    throw new Error(`Unsupported proxy protocol: ${proxyUrl}. Use http:// or socks5://`);
  }

  const res = await undiciFetch(url, { ...options, dispatcher });
  return res as unknown as Response;
}

/**
 * Test if proxy is working by fetching a URL through it
 */
export async function testProxy(proxyUrl: string): Promise<{ success: boolean; ip?: string; error?: string }> {
  try {
    const res = await proxyFetch('https://ip.im/', {
      headers: { 'User-Agent': 'curl/8.0' },
      signal: AbortSignal.timeout(10000),
    }, proxyUrl);

    if (res.ok) {
      const text = await res.text();
      // ip.im returns the IP address as plain text
      const ip = text.trim().split('\n')[0].trim();
      return { success: true, ip };
    } else {
      return { success: false, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
