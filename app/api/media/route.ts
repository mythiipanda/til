import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const ALLOWED_HOSTS = [
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'images.unsplash.com',
];

const CUSTOM_USER_AGENT = 'TDILEARNED-Agent/2.0 (educational research platform; contact@tdilearned.app)';

export async function GET(request: NextRequest) {
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
