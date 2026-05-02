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

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  const { user, token } = auth;

  try {
    const { fileName, fileSize, bookHash, temp = false } = await request.json();
    if (!fileName || !fileSize) {
      return json({ error: 'Missing file info' }, { status: 400 });
    }

    if (temp) {
      const timeStr = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 10);
      const fileKey = `temp/img/${timeStr}/${user.id.slice(0, 8)}/${fileName}`;
      const uploadUrl = await createObjectUrl(request, env, 'PUT', fileKey, 1800);
      const downloadUrl = await createObjectUrl(request, env, 'GET', fileKey, 3 * 86400);
      return json({ uploadUrl, downloadUrl });
    }

    const fileKey = `${user.id}/${fileName}`;
    const existing = await supabaseRest(
      env,
      token,
      `files?select=*&user_id=eq.${user.id}&file_key=eq.${encodeURIComponent(fileKey)}&limit=1`,
    );

    if (!existing?.length) {
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
            file_size: Number(fileSize),
          },
        ]),
      });
    }

    const uploadUrl = await createObjectUrl(request, env, 'PUT', fileKey, 1800);
    return json({
      uploadUrl,
      fileKey,
    });
  } catch (error) {
    return json({ error: error.message || 'Could not create upload URL' }, { status: 500 });
  }
}
