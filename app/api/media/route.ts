import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'images.unsplash.com',
];

const MAX_REQUESTS_PER_WINDOW = 120;
const WINDOW_MS = 60_000;
const requestLog = new Map<string, number[]>();

function enforceRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (requestLog.get(ip) || []).filter((t) => t > cutoff);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length <= MAX_REQUESTS_PER_WINDOW;
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

const CUSTOM_USER_AGENT = 'TDILEARNED-Agent/2.0 (educational research platform; contact@tdilearned.app)';

export async function GET(request: NextRequest) {
  if (!enforceRateLimit(clientIp(request))) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'Access-Control-Allow-Origin': '*', 'Retry-After': '60' },
    });
  }

  const { searchParams } = new URL(request.url);
  const targetUrlString = searchParams.get('url');

  if (!targetUrlString) {
    return new NextResponse('Missing required "url" parameter', {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(targetUrlString);
  } catch {
    return new NextResponse('Invalid target URL', {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const hostname = targetUrl.hostname.toLowerCase();
  const isAllowed = ALLOWED_HOSTS.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));

  if (!isAllowed) {
    return new NextResponse(`Forbidden host: ${hostname}`, {
      status: 403,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const originResponse = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': CUSTOM_USER_AGENT,
        'Accept-Encoding': 'gzip',
      },
    });

    if (!originResponse.ok) {
      return new NextResponse(`Origin returned ${originResponse.status}`, {
        status: originResponse.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const contentType = originResponse.headers.get('content-type') || 'image/jpeg';
    const body = await originResponse.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      },
    });
  } catch (error: any) {
    return new NextResponse(`Proxy error: ${error?.message || 'Unknown failure'}`, {
      status: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
