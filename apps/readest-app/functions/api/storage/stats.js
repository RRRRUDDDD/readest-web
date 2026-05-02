import {
  getStoragePlanData,
  handleOptions,
  json,
  requireUser,
  supabaseRest,
} from '../../_lib/readest-api.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  try {
    const pageSize = 1000;
    let offset = 0;
    const files = [];

    while (true) {
      const rows = await supabaseRest(
        env,
        auth.token,
        `files?select=file_size,book_hash&user_id=eq.${auth.user.id}&deleted_at=is.null&limit=${pageSize}&offset=${offset}`,
      );
      files.push(...(rows || []));
      if (!rows || rows.length < pageSize) break;
      offset += pageSize;
    }

    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + Number(file.file_size || 0), 0);
    const plan = getStoragePlanData(env, auth.token);
    const grouped = new Map();
    for (const file of files) {
      const key = file.book_hash || null;
      const current = grouped.get(key) || { fileCount: 0, totalSize: 0 };
      current.fileCount += 1;
      current.totalSize += Number(file.file_size || 0);
      grouped.set(key, current);
    }

    return json({
      totalFiles,
      totalSize,
      usage: plan.usage,
      quota: plan.quota,
      usagePercentage: plan.quota > 0 ? Math.round((plan.usage / plan.quota) * 100) : 0,
      byBookHash: [...grouped.entries()]
        .map(([bookHash, value]) => ({ bookHash, ...value }))
        .sort((a, b) => b.totalSize - a.totalSize),
    });
  } catch (error) {
    return json(
      { error: error.message || 'Failed to retrieve storage statistics' },
      { status: 500 },
    );
  }
}
