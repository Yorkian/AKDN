import { getDb } from '../db/connection';
import { getIPPrefix, normalizeIP } from '../utils/ip-utils';
import { config } from '../config';

/**
 * GeoIP lookup with multi-source fallback:
 *  1. ip-api.com  — free, no auth, 45 req/min, accessible from China
 *  2. ip.sb       — free, no auth, accessible from China
 *  3. ipinfo.io   — if token configured (may not work from China)
 */

interface GeoSource {
  name: string;
  buildUrl: (ip: string) => string;
  headers?: Record<string, string>;
  parse: (data: any) => { country: string; countryCode: string } | null;
}

const GEO_SOURCES: GeoSource[] = [
  {
    name: 'ip-api.com',
    buildUrl: (ip) => `http://ip-api.com/json/${ip}?fields=status,country,countryCode`,
    parse: (data) => {
      if (data.status === 'success' && data.country) {
        return { country: data.country, countryCode: data.countryCode || 'XX' };
      }
      return null;
    },
  },
  {
    name: 'ip.sb',
    buildUrl: (ip) => `https://api.ip.sb/geoip/${ip}`,
    parse: (data) => {
      if (data.country) {
        return { country: data.country, countryCode: data.country_code || 'XX' };
      }
      return null;
    },
  },
];

async function queryGeoAPI(ip: string): Promise<{ country: string; countryCode: string } | null> {
  for (const source of GEO_SOURCES) {
    try {
      const url = source.buildUrl(ip);
      const res = await fetch(url, {
        headers: source.headers || {},
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        console.warn(`GeoIP [${source.name}]: HTTP ${res.status} for ${ip}`);
        continue;
      }

      const data = await res.json() as any;
      const result = source.parse(data);

      if (result) {
        console.log(`GeoIP [${source.name}]: ${ip} → ${result.country} (${result.countryCode})`);
        return result;
      }

      console.warn(`GeoIP [${source.name}]: parse failed for ${ip}`);
    } catch (err) {
      console.warn(`GeoIP [${source.name}]: error for ${ip}:`, (err as Error).message);
    }
  }

  // Last resort: ipinfo.io if token configured
  if (config.ipinfoToken) {
    try {
      const res = await fetch(`https://api.ipinfo.io/lite/${ip}`, {
        headers: { 'Authorization': `Bearer ${config.ipinfoToken}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (data.country) {
          return { country: data.country, countryCode: data.country_code || 'XX' };
        }
      }
    } catch {}
  }

  return null;
}

export async function getCountryForIP(ip: string): Promise<{ country: string; countryCode: string } | null> {
  const normalized = normalizeIP(ip);
  if (!normalized || normalized === '127.0.0.1' || normalized === '::1') {
    return { country: 'Local', countryCode: 'LO' };
  }

  const prefix = getIPPrefix(normalized);
  const db = getDb();

  // Check cache
  try {
    const cached = db.prepare(
      "SELECT country, country_code FROM ip_geo_cache WHERE ip_prefix = ? AND expires_at > datetime('now')"
    ).get(prefix) as any;

    if (cached) {
      return { country: cached.country, countryCode: cached.country_code };
    }
  } catch {}

  // Query API chain
  const result = await queryGeoAPI(normalized);
  if (!result) return null;

  // Write cache
  try {
    const expiresAt = new Date(Date.now() + config.geoCacheTtl).toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO ip_geo_cache (ip_prefix, country, country_code, created_at, expires_at)
      VALUES (?, ?, ?, datetime('now'), ?)
    `).run(prefix, result.country, result.countryCode, expiresAt);
  } catch (err) {
    console.error('GeoIP cache write error:', err);
  }

  return result;
}
