const DEFAULT_STORAGE_QUOTA = 10 * 1024 * 1024 * 1024;
const STORAGE_QUOTA_GRACE_BYTES = 10 * 1024 * 1024;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function getSupabaseConfig(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured');
  }
  return { url: url.replace(/\/$/, ''), key };
}

export async function validateUser(request, env) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return {};

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { url, key } = getSupabaseConfig(env);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return {};
  const user = await response.json();
  if (!user?.id) return {};
  return { user, token };
}

export async function requireUser(request, env) {
  const { user, token } = await validateUser(request, env);
  if (!user || !token) {
    return { error: json({ error: 'Not authenticated' }, { status: 403 }) };
  }
  return { user, token };
}

export async function supabaseRest(env, token, path, init = {}) {
  const { url, key } = getSupabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { message: response.statusText };
    }
    throw new Error(error.message || error.details || response.statusText);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

export function getStoragePlanData(env, token) {
  const data = decodeJwt(token);
  const fixedQuota = Number(env.STORAGE_FIXED_QUOTA || env.NEXT_PUBLIC_STORAGE_FIXED_QUOTA || 0);
  const purchasedQuota = Number(data.storage_purchased_bytes || 0);
  const usage = Number(data.storage_usage_bytes || 0);
  return {
    usage,
    quota: (fixedQuota || DEFAULT_STORAGE_QUOTA) + purchasedQuota,
  };
}

export function canStoreFile(env, token, fileSize) {
  const { usage, quota } = getStoragePlanData(env, token);
  return {
    allowed: usage + fileSize <= quota + STORAGE_QUOTA_GRACE_BYTES,
    usage,
    quota,
  };
}

export function transformBookToDB(book, userId) {
  return {
    user_id: userId,
    book_hash: book.hash,
    meta_hash: book.metaHash,
    format: book.format,
    title: book.title || '',
    author: book.author || '',
    // Use `?? null` so cleared fields are propagated to the server. Without
    // this, JSON.stringify would drop undefined values from the upsert
    // payload — and PostgREST's "ON CONFLICT DO UPDATE" only updates
    // columns present in the INSERT list, so the server-side group_id /
    // group_name would silently retain their old values. The next pull
    // would then bring those stale values back, undoing "Remove From Group".
    group_id: book.groupId ?? null,
    group_name: book.groupName ?? null,
    tags: book.tags,
    progress: book.progress,
    reading_status: book.readingStatus,
    source_title: book.sourceTitle,
    metadata: book.metadata || null,
    created_at: new Date(book.createdAt || Date.now()).toISOString(),
    updated_at: new Date(book.updatedAt || Date.now()).toISOString(),
    deleted_at: book.deletedAt ? new Date(book.deletedAt).toISOString() : null,
    uploaded_at: book.uploadedAt ? new Date(book.uploadedAt).toISOString() : null,
  };
}

export function transformBookConfigToDB(config, userId) {
  return {
    user_id: userId,
    book_hash: config.bookHash,
    meta_hash: config.metaHash,
    location: config.location,
    xpointer: config.xpointer,
    progress: config.progress || null,
    rsvp_position: config.rsvpPosition ? JSON.stringify(config.rsvpPosition) : null,
    search_config: config.searchConfig || null,
    view_settings: config.viewSettings || null,
    updated_at: new Date(config.updatedAt || Date.now()).toISOString(),
  };
}

export function transformBookNoteToDB(note, userId) {
  return {
    user_id: userId,
    book_hash: note.bookHash,
    meta_hash: note.metaHash,
    id: note.id,
    type: note.type,
    cfi: note.cfi,
    xpointer0: note.xpointer0,
    xpointer1: note.xpointer1,
    page: note.page,
    text: note.text,
    style: note.style,
    color: note.color,
    note: note.note,
    created_at: new Date(note.createdAt || Date.now()).toISOString(),
    updated_at: new Date(note.updatedAt || Date.now()).toISOString(),
    deleted_at: note.deletedAt ? new Date(note.deletedAt).toISOString() : null,
  };
}

export function getObjectBucket(env) {
  const bucket = env.READEST_FILES_R2_BUCKET || env.NEXT_INC_CACHE_R2_BUCKET;
  if (!bucket) throw new Error('R2 bucket binding is not configured');
  return bucket;
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createObjectUrl(
  request,
  env,
  method,
  fileKey,
  expiresIn = 1800,
  size = null,
) {
  const secret = env.STORAGE_SIGNING_SECRET;
  if (!secret) throw new Error('STORAGE_SIGNING_SECRET is not configured');

  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const sizePart = size === null || size === undefined ? '' : String(size);
  const signature = await hmacHex(secret, `${method}\n${fileKey}\n${expires}\n${sizePart}`);
  const url = new URL('/api/storage/object', request.url);
  url.searchParams.set('fileKey', fileKey);
  url.searchParams.set('expires', expires.toString());
  if (sizePart) url.searchParams.set('size', sizePart);
  url.searchParams.set('signature', signature);
  return url.toString();
}

export async function verifyObjectSignature(request, env) {
  const secret = env.STORAGE_SIGNING_SECRET;
  if (!secret) return { error: 'STORAGE_SIGNING_SECRET is not configured' };

  const url = new URL(request.url);
  const fileKey = url.searchParams.get('fileKey') || '';
  const expires = Number(url.searchParams.get('expires') || 0);
  const size = url.searchParams.get('size') || '';
  const signature = url.searchParams.get('signature') || '';
  if (!fileKey || !expires || !signature) return { error: 'Invalid signed URL' };
  if (Date.now() / 1000 > expires) return { error: 'Signed URL expired' };

  const expected = await hmacHex(secret, `${request.method}\n${fileKey}\n${expires}\n${size}`);
  const legacyExpected = size
    ? null
    : await hmacHex(secret, `${request.method}\n${fileKey}\n${expires}`);
  if (expected !== signature && legacyExpected !== signature)
    return { error: 'Invalid signed URL' };
  return { fileKey, size: size ? Number(size) : null };
}
