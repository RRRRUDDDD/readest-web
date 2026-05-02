const READEST_OPDS_USER_AGENT = 'Readest/1.0 (OPDS Browser)';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
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

  try {
    new URL(url);
  } catch {
    return json({ error: 'Invalid URL format' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const headers = new Headers({
      'User-Agent': READEST_OPDS_USER_AGENT,
      Accept: 'application/atom+xml, application/xml, text/xml, application/json, */*',
    });

    for (const [key, value] of Object.entries(customHeaders)) {
      headers.set(key, value);
    }
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

    if (stream === 'true' && contentLength && Number(contentLength) > 1024 * 1024) {
      return new Response(response.body, {
        status: 200,
        headers: buildResponseHeaders({
          'Content-Type': contentType,
          'X-Content-Length': contentLength,
          'Access-Control-Expose-Headers': 'X-Content-Length',
        }),
      });
    }

    const body = await response.arrayBuffer();
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
