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

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

function isLanAddress(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return true;
    }

    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [, a, b, c, d] = ipv4.map(Number);
      if ([a, b, c, d].some((part) => part === undefined || part > 255)) return false;
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
    }

    const ipv6 = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
    return (
      ipv6.includes(':') &&
      (ipv6 === '::1' ||
        ipv6.startsWith('fe80:') ||
        ipv6.startsWith('fc00:') ||
        ipv6.startsWith('fd00:'))
    );
  } catch {
    return false;
  }
}

function isSafeServerUrl(serverUrl) {
  try {
    const url = new URL(serverUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (isLanAddress(url.toString())) return false;
    return true;
  } catch {
    return false;
  }
}

function buildTargetUrl(serverUrl, endpoint) {
  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) return null;
  const base = new URL(serverUrl);
  const target = new URL(endpoint, base);
  return target.origin === base.origin ? target.toString() : null;
}

function sanitizeHeaders(headers = {}) {
  const sanitized = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (ALLOWED_HEADERS.has(key.toLowerCase())) {
      sanitized.set(key, value);
    }
  }
  return sanitized;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost({ request }) {
  try {
    const { serverUrl, endpoint, method = 'GET', headers = {}, body } = await request.json();

    if (!serverUrl || !isSafeServerUrl(serverUrl)) {
      return json({ error: 'Invalid KOSync server URL' }, { status: 400 });
    }

    if (!ALLOWED_METHODS.has(method)) {
      return json({ error: 'Invalid KOSync method' }, { status: 400 });
    }

    const targetUrl = buildTargetUrl(serverUrl, endpoint);
    if (!targetUrl) {
      return json({ error: 'Invalid KOSync endpoint' }, { status: 400 });
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

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return json({ error: error.message || 'KOSync proxy failed' }, { status: 500 });
  }
}
