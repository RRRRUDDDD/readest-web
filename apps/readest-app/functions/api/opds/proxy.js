const READEST_OPDS_USER_AGENT = 'Readest/1.0 (OPDS Browser)';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const BLOCKED_REQUEST_HEADERS = new Set([
  'authorization',
  'connection',
  'content-length',
  'cookie',
  'host',
  'proxy-authorization',
  'te',
  'transfer-encoding',
  'upgrade',
]);
const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const MAX_HEADER_VALUE_LENGTH = 2048;
const MAX_BUFFER_BYTES = 50 * 1024 * 1024;

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

function deserializeCustomHeaders(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, val]) => [key.trim(), String(val).trim()])
        .filter(([key, val]) => key && val),
    );
  } catch {
    return {};
  }
}

function getUrlParameter(request) {
  const fullUrl = request.url;
  const urlParamStart = fullUrl.indexOf('url=');
  if (urlParamStart < 0) return '';

  const valueStart = urlParamStart + 4;
  const boundaries = ['&stream=', '&auth=', '&headers=']
    .map((marker) => fullUrl.lastIndexOf(marker))
    .filter((index) => index > valueStart);
  const valueEnd = boundaries.length ? Math.min(...boundaries) : fullUrl.length;
  return decodeURIComponent(fullUrl.substring(valueStart, valueEnd));
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

function validateProxyTarget(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'Only HTTP and HTTPS OPDS URLs are supported';
    }
    if (parsed.username || parsed.password) {
      return 'Credentials in OPDS URLs are not allowed; use catalog authentication settings';
    }
    if (isLanAddress(parsed.toString()) || parsed.hostname.endsWith('.local')) {
      return 'Private network OPDS URLs cannot be fetched through the web proxy';
    }
    return null;
  } catch {
    return 'Invalid URL format';
  }
}

function applyCustomHeaders(headers, customHeaders) {
  for (const [key, value] of Object.entries(customHeaders)) {
    const normalizedKey = key.toLowerCase();
    if (
      HEADER_NAME_RE.test(key) &&
      !normalizedKey.startsWith('sec-') &&
      !normalizedKey.startsWith('proxy-') &&
      !BLOCKED_REQUEST_HEADERS.has(normalizedKey) &&
      value.length <= MAX_HEADER_VALUE_LENGTH
    ) {
      headers.set(key, value);
    }
  }
}

async function handleRequest(request, method) {
  const requestUrl = new URL(request.url);
  const url = getUrlParameter(request);
  const auth = requestUrl.searchParams.get('auth');
  const stream = requestUrl.searchParams.get('stream');
  const customHeaders = deserializeCustomHeaders(requestUrl.searchParams.get('headers'));

  if (!url) {
    return json(
      { error: 'Missing URL parameter. Usage: /api/opds/proxy?url=YOUR_OPDS_URL' },
      {
        status: 400,
      },
    );
  }

  const validationError = validateProxyTarget(url);
  if (validationError) {
    return json({ error: validationError }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const headers = new Headers({
      'User-Agent': READEST_OPDS_USER_AGENT,
      Accept: 'application/atom+xml, application/xml, text/xml, application/json, */*',
    });

    applyCustomHeaders(headers, customHeaders);
    if (auth) {
      headers.set('Authorization', auth);
    }

    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const excludedHeaders = new Set([
      'content-encoding',
      'content-length',
      'transfer-encoding',
      'connection',
      'keep-alive',
    ]);
    const upstreamContentDisposition = response.headers.get('Content-Disposition');
    const isFileDownload =
      stream === 'true' || (upstreamContentDisposition ?? '').toLowerCase().includes('attachment');

    const buildResponseHeaders = (extras = {}) => {
      const h = new Headers();
      for (const [key, value] of response.headers.entries()) {
        if (!excludedHeaders.has(key.toLowerCase())) {
          h.set(key, value);
        }
      }
      h.set('Cache-Control', isFileDownload ? 'no-store' : 'public, max-age=300');
      for (const [key, value] of Object.entries(corsHeaders)) h.set(key, value);
      for (const [key, value] of Object.entries(extras)) h.set(key, value);
      return h;
    };

    if (!response.ok) {
      const body = method === 'HEAD' ? null : await response.text();
      return new Response(body, {
        status: response.status === 401 ? 403 : response.status,
        headers: buildResponseHeaders(),
      });
    }

    const contentType = response.headers.get('Content-Type') || 'text/xml';
    const contentLength = response.headers.get('Content-Length');

    if (method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: buildResponseHeaders({
          'Content-Type': contentType,
          ...(contentLength ? { 'Content-Length': contentLength } : {}),
        }),
      });
    }

    const contentLengthNumber = contentLength ? Number(contentLength) : 0;
    if (stream === 'true' && contentLength && contentLengthNumber > 1024 * 1024) {
      return new Response(response.body, {
        status: 200,
        headers: buildResponseHeaders({
          'Content-Type': contentType,
          'X-Content-Length': contentLength,
          'Access-Control-Expose-Headers': 'X-Content-Length',
        }),
      });
    }

    if (contentLengthNumber > MAX_BUFFER_BYTES) {
      return json(
        { error: 'Response is too large to buffer; retry as a streamed download' },
        { status: 413 },
      );
    }

    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_BUFFER_BYTES) {
      return json(
        { error: 'Response is too large to buffer; retry as a streamed download' },
        { status: 413 },
      );
    }
    return new Response(body, {
      status: 200,
      headers: buildResponseHeaders({
        'Content-Type': contentType,
        'Content-Length': body.byteLength.toString(),
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return json(
        { error: 'Request timeout - the OPDS server took too long to respond' },
        {
          status: 504,
        },
      );
    }
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch OPDS feed',
        url,
        hint: 'Check if the OPDS URL is accessible and returns valid OPDS/Atom/JSON content',
      },
      { status: 500 },
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestGet({ request }) {
  return handleRequest(request, 'GET');
}

export async function onRequestHead({ request }) {
  return handleRequest(request, 'HEAD');
}
