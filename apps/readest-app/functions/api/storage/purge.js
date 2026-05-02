import {
  getObjectBucket,
  handleOptions,
  json,
  requireUser,
  supabaseRest,
} from '../../_lib/readest-api.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  try {
    const { fileKeys } = await request.json();
    if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
      return json({ error: 'Missing or invalid fileKeys array' }, { status: 400 });
    }
    if (fileKeys.length > 100) {
      return json({ error: 'Cannot delete more than 100 files at once' }, { status: 400 });
    }

    const encodedKeys = fileKeys.map((key) => `"${String(key).replace(/"/g, '\\"')}"`).join(',');
    const rows = await supabaseRest(
      env,
      auth.token,
      `files?select=id,user_id,file_key&user_id=eq.${auth.user.id}&file_key=in.(${encodedKeys})&deleted_at=is.null`,
    );
    const bucket = getObjectBucket(env);
    const success = [];
    const failed = [];

    for (const row of rows || []) {
      try {
        await bucket.delete(row.file_key);
        await supabaseRest(env, auth.token, `files?id=eq.${row.id}`, { method: 'DELETE' });
        success.push(row.file_key);
      } catch (error) {
        failed.push({ fileKey: row.file_key, error: error.message || 'Delete failed' });
      }
    }

    const found = new Set((rows || []).map((row) => row.file_key));
    for (const fileKey of fileKeys) {
      if (!found.has(fileKey)) failed.push({ fileKey, error: 'File not found or already deleted' });
    }

    return json(
      {
        success,
        failed,
        deletedCount: success.length,
        failedCount: failed.length,
      },
      { status: failed.length && success.length ? 207 : failed.length ? 500 : 200 },
    );
  } catch (error) {
    return json({ error: error.message || 'Something went wrong' }, { status: 500 });
  }
}
