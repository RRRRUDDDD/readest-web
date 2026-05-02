import {
  corsHeaders,
  getObjectBucket,
  handleOptions,
  json,
  verifyObjectSignature,
} from '../../_lib/readest-api.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPut({ request, env }) {
  const verified = await verifyObjectSignature(request, env);
  if (verified.error) return json({ error: verified.error }, { status: 403 });

  try {
    await getObjectBucket(env).put(verified.fileKey, request.body, {
      httpMetadata: {
        contentType: request.headers.get('content-type') || 'application/octet-stream',
      },
    });
    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

export async function onRequestGet({ request, env }) {
  const verified = await verifyObjectSignature(request, env);
  if (verified.error) return json({ error: verified.error }, { status: 403 });

  try {
    const object = await getObjectBucket(env).get(verified.fileKey);
    if (!object) return json({ error: 'File not found' }, { status: 404 });

    const headers = new Headers(corsHeaders);
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    return new Response(object.body, { headers });
  } catch (error) {
    return json({ error: error.message || 'Download failed' }, { status: 500 });
  }
}
