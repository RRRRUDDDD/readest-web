import {
  createObjectUrl,
  canStoreFile,
  handleOptions,
  json,
  requireUser,
  supabaseRest,
} from '../../_lib/readest-api.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  const { user, token } = auth;

  try {
    const { fileName, fileSize, bookHash, temp = false } = await request.json();
    const numericFileSize = Number(fileSize);
    if (!fileName || !Number.isFinite(numericFileSize) || numericFileSize <= 0) {
      return json({ error: 'Missing file info' }, { status: 400 });
    }

    if (temp) {
      const timeStr = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 10);
      const fileKey = `temp/img/${timeStr}/${user.id.slice(0, 8)}/${fileName}`;
      const uploadUrl = await createObjectUrl(request, env, 'PUT', fileKey, 1800, numericFileSize);
      const downloadUrl = await createObjectUrl(request, env, 'GET', fileKey, 3 * 86400);
      return json({ uploadUrl, downloadUrl });
    }

    const fileKey = `${user.id}/${fileName}`;
    const existing = await supabaseRest(
      env,
      token,
      `files?select=*&user_id=eq.${user.id}&file_key=eq.${encodeURIComponent(fileKey)}&limit=1`,
    );

    const objectSize = existing?.[0]?.file_size || numericFileSize;
    if (!existing?.length) {
      const quota = canStoreFile(env, token, numericFileSize);
      if (!quota.allowed) {
        return json(
          { error: 'Storage quota exceeded', usage: quota.usage, quota: quota.quota },
          { status: 413 },
        );
      }

      await supabaseRest(env, token, 'files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          {
            user_id: user.id,
            book_hash: bookHash,
            file_key: fileKey,
            file_size: numericFileSize,
          },
        ]),
      });
    }

    const uploadUrl = await createObjectUrl(request, env, 'PUT', fileKey, 1800, objectSize);
    return json({
      uploadUrl,
      fileKey,
    });
  } catch (error) {
    return json({ error: error.message || 'Could not create upload URL' }, { status: 500 });
  }
}
