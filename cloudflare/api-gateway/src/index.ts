/**
 * Edge API Gateway — rate-limits then proxies /api/v1/* to the Azure backend.
 *
 * Real client IPs come from CF-Connecting-IP (trusted, set by Cloudflare) and
 * are forwarded to the backend as `x-cf-client-ip` so the backend's in-memory
 * limiter keys on the true client instead of a spoofable hop.
 *
 * Global rate limiting is enforced here at the edge with a Durable Object
 * sliding window — distributed, real IPs, and zero cost.
 */

import { DurableObject } from 'cloudflare:workers';

const BACKEND_ORIGIN = 'https://tdilearned-backend.azurewebsites.net';

interface RateLimiterStub {
  check(limit: number, windowSec: number): Promise<{ allowed: boolean; retryAfter: number }>;
}

const LIMITS: Record<string, { max: number; windowSec: number }> = {
  '/api/v1/research/stream': { max: 15, windowSec: 60 },
  '/api/v1/chat/stream': { max: 30, windowSec: 60 },
};

const DEFAULT_LIMIT = { max: 60, windowSec: 60 };

/** Sliding-window rate limiter stored in a Durable Object per client IP. */
export class RateLimiterDO extends DurableObject {
  private timestamps: number[] = [];

  async check(limit: number, windowSec: number): Promise<{ allowed: boolean; retryAfter: number }> {
    const now = Date.now() / 1000;
    const cutoff = now - windowSec;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    if (this.timestamps.length >= limit) {
      return { allowed: false, retryAfter: Math.ceil(windowSec) };
    }
    this.timestamps.push(now);
    return { allowed: true, retryAfter: 0 };
  }
}

export default {
  async fetch(request: Request, env: { RATE_LIMITER: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url);

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

    const limitConfig = LIMITS[url.pathname] ?? DEFAULT_LIMIT;
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const doId = env.RATE_LIMITER.idFromName(`rl:${clientIp}`);
    const stub = env.RATE_LIMITER.get(doId) as unknown as RateLimiterStub;

    const { allowed, retryAfter } = await stub.check(limitConfig.max, limitConfig.windowSec);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please wait ${retryAfter} seconds.`,
          retry_after: retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Retry-After': String(retryAfter),
          },
        }
      );
    }

    const target = BACKEND_ORIGIN + url.pathname + url.search;
    const originHeaders = new Headers(request.headers);
    originHeaders.set('x-cf-client-ip', clientIp);
    originHeaders.set('x-forwarded-for', clientIp);
    originHeaders.delete('host');

    try {
      const originResponse = await fetch(target, {
        method: request.method,
        headers: originHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'follow',
      });

      const responseHeaders = new Headers(originResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown failure';
      return new Response(
        JSON.stringify({ error: 'Backend unreachable', message }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }
  },
};