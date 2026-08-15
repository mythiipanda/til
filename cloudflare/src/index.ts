/**
 * Cloudflare Edge Worker: Zero-Cost Media & Tile Proxy
 * Injects compliant origin headers and applies immutable CDN caching headers.
 */

const ALLOWED_HOSTS = [
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'images.unsplash.com',
];

const CUSTOM_USER_AGENT = 'InfiniteCuriosityEngine/1.0 (https://curiosity.platform; contact@curiosity.platform)';

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (url.pathname !== '/media') {
      return new Response('Infinite Curiosity Engine Media Proxy. Use /media?url=<ENCODED_URL>', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const targetUrlString = url.searchParams.get('url');
    if (!targetUrlString) {
      return new Response('Missing required "url" parameter', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(targetUrlString);
    } catch {
      return new Response('Invalid target URL', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Host validation
    const hostname = targetUrl.hostname.toLowerCase();
    const isAllowed = ALLOWED_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
    if (!isAllowed) {
      return new Response(`Forbidden host: ${hostname}. Only approved Wikimedia and OpenStreetMap domains are permitted.`, {
        status: 403,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Inspect Edge Cache
    const cache = (caches as any).default;
    const cacheKey = new Request(targetUrl.toString(), request);
    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const response = new Response(cachedResponse.body, cachedResponse);
      response.headers.set('X-Edge-Cache', 'HIT');
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // Fetch from origin with compliant User-Agent
    const originHeaders = new Headers();
    originHeaders.set('User-Agent', CUSTOM_USER_AGENT);
    originHeaders.set('Accept-Encoding', 'gzip');
    if (request.headers.get('Accept')) {
      originHeaders.set('Accept', request.headers.get('Accept')!);
    }

    try {
      const originResponse = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: originHeaders,
      });

      if (!originResponse.ok) {
        return new Response(`Origin returned HTTP ${originResponse.status}`, {
          status: originResponse.status,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      const responseHeaders = new Headers(originResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      // Immutable Edge & Browser Caching
      responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
      responseHeaders.set('X-Edge-Cache', 'MISS');

      const response = new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders,
      });

      // Save to Cloudflare Edge Cache in background
      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    } catch (err: any) {
      return new Response(`Proxy error: ${err?.message || 'Unknown failure'}`, {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
