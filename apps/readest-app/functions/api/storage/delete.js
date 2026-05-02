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

  const url = new URL(request.url);
  const fileKey = url.searchParams.get('fileKey');
  if (!fileKey) return json({ error: 'Missing or invalid fileKey' }, { status: 400 });

  try {
    const rows = await supabaseRest(
      env,
      auth.token,
      `files?select=id,user_id,file_key&user_id=eq.${auth.user.id}&file_key=eq.${encodeURIComponent(fileKey)}&limit=1`,
    );
    const record = rows?.[0];
    if (!record) return json({ error: 'File not found' }, { status: 404 });

    await getObjectBucket(env).delete(record.file_key);
    await supabaseRest(env, auth.token, `files?id=eq.${record.id}`, { method: 'DELETE' });
    return json({ message: 'File deleted successfully' });
  } catch (error) {
    return json({ error: error.message || 'Could not delete file' }, { status: 500 });
  }
}
