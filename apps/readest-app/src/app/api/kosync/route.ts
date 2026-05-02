import { NextRequest, NextResponse } from 'next/server';
import { isLanAddress } from '@/utils/network';
import type { KoSyncProxyPayload } from '@/types/kosync';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT']);
const ALLOWED_HEADERS = new Set([
  'accept',
  'authorization',
  'content-type',
  'x-auth-key',
  'x-auth-user',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const isSafeServerUrl = (serverUrl: string) => {
  try {
    const url = new URL(serverUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (isLanAddress(url.toString())) return false;
    return true;
  } catch {
    return false;
  }
};

const buildTargetUrl = (serverUrl: string, endpoint: string) => {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) return null;
  const base = new URL(serverUrl);
  const target = new URL(endpoint, base);
  return target.origin === base.origin ? target.toString() : null;
};

const sanitizeHeaders = (headers: Record<string, string>) => {
  const sanitized = new Headers();
  for (const [key, value] of Object.entries(headers || {})) {
    const normalizedKey = key.toLowerCase();
    if (ALLOWED_HEADERS.has(normalizedKey)) {
      sanitized.set(key, value);
    }
  }
  return sanitized;
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as KoSyncProxyPayload;
    const { serverUrl, endpoint, method = 'GET', headers = {}, body } = payload;

    if (!serverUrl || !isSafeServerUrl(serverUrl)) {
      return NextResponse.json({ error: 'Invalid KOSync server URL' }, { status: 400 });
    }

    if (!ALLOWED_METHODS.has(method)) {
      return NextResponse.json({ error: 'Invalid KOSync method' }, { status: 400 });
    }

    const targetUrl = buildTargetUrl(serverUrl, endpoint);
    if (!targetUrl) {
      return NextResponse.json({ error: 'Invalid KOSync endpoint' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(targetUrl, {
      method,
      headers: sanitizeHeaders(headers),
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseHeaders = new Headers(corsHeaders);
    const contentType = upstream.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);

    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KOSync proxy failed';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
