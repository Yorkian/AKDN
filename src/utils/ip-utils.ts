import net from 'net';

export function isIPv6(ip: string): boolean {
  return net.isIPv6(ip);
}

export function isIPv4(ip: string): boolean {
  return net.isIPv4(ip);
}

/**
 * Normalize IP: strip IPv4-mapped IPv6 prefix (::ffff:x.x.x.x → x.x.x.x)
 * This is critical because Fastify on dual-stack sockets returns ::ffff: prefix
 */
export function normalizeIP(ip: string): string {
  if (!ip) return ip;
  // Handle ::ffff:x.x.x.x (IPv4-mapped IPv6)
  const ffmpMatch = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ffmpMatch) return ffmpMatch[1];
  // Handle longer form like 0:0:0:0:0:ffff:1.2.3.4
  const longMatch = ip.match(/^(?:0:){5}ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (longMatch) return longMatch[1];
  return ip;
}

export function getIPv4Prefix(ip: string): string {
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

export function expandIPv6(ip: string): string {
  let groups = ip.split(':');
  const doubleColonIndex = ip.indexOf('::');
  if (doubleColonIndex !== -1) {
    const before = ip.substring(0, doubleColonIndex).split(':').filter(g => g !== '');
    const after = ip.substring(doubleColonIndex + 2).split(':').filter(g => g !== '');
    const missing = 8 - before.length - after.length;
    groups = [...before, ...Array(missing).fill('0000'), ...after];
  }
  return groups.map(g => g.padStart(4, '0')).join(':');
}

export function getIPv6Prefix(ip: string): string {
  const full = expandIPv6(ip);
  const groups = full.split(':');
  return `${groups.slice(0, 4).join(':')}::/64`;
}

export function getIPPrefix(ip: string): string {
  // MUST normalize first - ::ffff: mapped IPs are the most common case
  const normalized = normalizeIP(ip);
  if (isIPv4(normalized)) return getIPv4Prefix(normalized);
  if (isIPv6(normalized)) return getIPv6Prefix(normalized);
  return normalized;
}

export function extractClientIP(request: any): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const first = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    return normalizeIP(first);
  }
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    const ip = typeof realIp === 'string' ? realIp : realIp[0];
    return normalizeIP(ip);
  }
  return normalizeIP(request.ip || '127.0.0.1');
}
