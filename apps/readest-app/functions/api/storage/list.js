import { handleOptions, json, requireUser, supabaseRest } from '../../_lib/readest-api.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') || 50), 100);
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const bookHash = url.searchParams.get('bookHash') || '';
    const search = url.searchParams.get('search') || '';
    const validSortColumns = new Set(['created_at', 'updated_at', 'file_size', 'file_key']);
    const sortColumn = validSortColumns.has(sortBy) ? sortBy : 'created_at';
    const offset = (page - 1) * pageSize;

    const query = new URLSearchParams();
    query.set('select', 'file_key,file_size,book_hash,created_at,updated_at');
    query.set('user_id', `eq.${auth.user.id}`);
    query.set('deleted_at', 'is.null');
    query.set('order', `${sortColumn}.${sortOrder}`);
    query.set('limit', String(pageSize));
    query.set('offset', String(offset));
    if (bookHash) query.set('book_hash', `eq.${bookHash}`);
    if (search) query.set('file_key', `ilike.*${search.replace(/\*/g, '')}*`);

    const files = await supabaseRest(env, auth.token, `files?${query.toString()}`);
    const countQuery = new URLSearchParams(query);
    countQuery.set('select', 'id');
    countQuery.delete('order');
    countQuery.delete('limit');
    countQuery.delete('offset');
    const allMatching = await supabaseRest(env, auth.token, `files?${countQuery.toString()}`);

    return json({
      files: files || [],
      total: allMatching?.length || 0,
      page,
      pageSize,
      totalPages: Math.ceil((allMatching?.length || 0) / pageSize),
    });
  } catch (error) {
    return json({ error: error.message || 'Failed to retrieve files' }, { status: 500 });
  }
}
