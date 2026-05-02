import {
  createObjectUrl,
  handleOptions,
  json,
  requireUser,
  supabaseRest,
} from '../../_lib/readest-api.js';

export async function onRequestOptions() {
  return handleOptions();
}

async function processFileKeys(request, env, token, userId, fileKeys) {
  const encodedKeys = fileKeys.map((key) => `"${String(key).replace(/"/g, '\\"')}"`).join(',');
  const rows = await supabaseRest(
    env,
    token,
    `files?select=user_id,file_key,book_hash&user_id=eq.${userId}&file_key=in.(${encodedKeys})&deleted_at=is.null`,
  );
  const recordMap = new Map((rows || []).map((row) => [row.file_key, row]));
  const result = {};

  for (const fileKey of fileKeys) {
    const record = recordMap.get(fileKey);
    result[fileKey] =
      record?.user_id === userId
        ? await createObjectUrl(request, env, 'GET', record.file_key, 1800)
        : undefined;
  }

  return result;
}

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const fileKey = url.searchParams.get('fileKey');
  if (!fileKey) return json({ error: 'Missing or invalid fileKey' }, { status: 400 });

  try {
    const urls = await processFileKeys(request, env, auth.token, auth.user.id, [fileKey]);
    const downloadUrl = urls[fileKey];
    if (!downloadUrl) return json({ error: 'File not found' }, { status: 404 });
    return json({ downloadUrl });
  } catch (error) {
    return json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  try {
    const { fileKeys } = await request.json();
    if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
      return json({ error: 'Missing or invalid fileKeys array' }, { status: 400 });
    }

    const downloadUrls = await processFileKeys(request, env, auth.token, auth.user.id, fileKeys);
    return json({ downloadUrls });
  } catch (error) {
    return json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}
