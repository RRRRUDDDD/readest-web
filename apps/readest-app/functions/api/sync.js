import {
  handleOptions,
  json,
  requireUser,
  supabaseRest,
  transformBookConfigToDB,
  transformBookNoteToDB,
  transformBookToDB,
} from '../_lib/readest-api.js';

const tableTransforms = {
  books: transformBookToDB,
  book_configs: transformBookConfigToDB,
  book_notes: transformBookNoteToDB,
};

const responseKeys = {
  books: 'books',
  book_configs: 'configs',
  book_notes: 'notes',
};

const requestTables = {
  books: 'books',
  configs: 'book_configs',
  notes: 'book_notes',
};

function dbTime(value) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function recordIsNewer(client, server) {
  const clientUpdatedAt = dbTime(client.updated_at);
  const serverUpdatedAt = dbTime(server.updated_at);
  const clientDeletedAt = dbTime(client.deleted_at);
  const serverDeletedAt = dbTime(server.deleted_at);
  return clientDeletedAt > serverDeletedAt || clientUpdatedAt > serverUpdatedAt;
}

function eqFilter(value) {
  return String(value).replace(/"/g, '\\"');
}

function stringifyJsonField(value) {
  if (!value || typeof value === 'string') return value;
  return JSON.stringify(value);
}

function normalizeRecord(table, record) {
  if (table === 'books') {
    return {
      ...record,
      metadata: stringifyJsonField(record.metadata),
    };
  }

  if (table === 'book_configs') {
    return {
      ...record,
      progress: stringifyJsonField(record.progress),
      rsvp_position: stringifyJsonField(record.rsvp_position),
      search_config: stringifyJsonField(record.search_config),
      view_settings: stringifyJsonField(record.view_settings),
    };
  }

  return record;
}

async function queryTable(env, token, user, table, params) {
  const pageSize = 1000;
  const records = [];
  let offset = 0;

  while (true) {
    const query = new URLSearchParams();
    query.set('select', '*');
    query.set('user_id', `eq.${user.id}`);
    query.set('limit', String(pageSize));
    query.set('offset', String(offset));
    query.set('order', 'updated_at.desc');

    if (params.book && params.metaHash) {
      query.append(
        'or',
        `(book_hash.eq.${eqFilter(params.book)},meta_hash.eq.${eqFilter(params.metaHash)})`,
      );
    } else if (params.book) {
      query.set('book_hash', `eq.${eqFilter(params.book)}`);
    } else if (params.metaHash) {
      query.set('meta_hash', `eq.${eqFilter(params.metaHash)}`);
    }

    query.append('or', `(updated_at.gt.${params.sinceIso},deleted_at.gt.${params.sinceIso})`);
    const batch = await supabaseRest(env, token, `${table}?${query.toString()}`);
    records.push(...(batch || []).map((record) => normalizeRecord(table, record)));
    if (!batch || batch.length < pageSize) break;
    offset += pageSize;
  }

  if (table === 'book_notes') {
    const seen = new Set();
    return records.filter((record) => {
      if (seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    });
  }

  return records;
}

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  const { user, token } = auth;

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get('since');
  if (!sinceParam) return json({ error: '"since" query parameter is required' }, { status: 400 });

  const since = new Date(Number(sinceParam));
  if (Number.isNaN(since.getTime())) {
    return json({ error: 'Invalid "since" timestamp' }, { status: 400 });
  }

  const type = url.searchParams.get('type') || '';
  const table = requestTables[type];
  const tables = table ? [table] : ['books', 'book_configs', 'book_notes'];
  const params = {
    sinceIso: since.toISOString(),
    book: url.searchParams.get('book') || '',
    metaHash: url.searchParams.get('meta_hash') || '',
  };

  try {
    const result = { books: [], configs: [], notes: [] };
    for (const tableName of tables) {
      result[responseKeys[tableName]] = await queryTable(env, token, user, tableName, params);
    }

    if ((!type || type === 'books') && result.books.length === 0 && since.getTime() < 1000) {
      const dummyHash = '00000000000000000000000000000000';
      const now = Date.now();
      result.books.push({
        user_id: user.id,
        id: dummyHash,
        book_hash: dummyHash,
        deleted_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
        hash: dummyHash,
        title: 'Dummy Book',
        format: 'EPUB',
        author: '',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      });
    }

    return json(result, {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    return json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}

function recordKey(record, primaryKeys) {
  return primaryKeys.map((key) => record[key]).join('|');
}

async function fetchExistingBatch(env, token, table, userId, records, primaryKeys) {
  if (records.length === 0) return new Map();
  const query = new URLSearchParams();
  query.set('select', '*');
  const clauses = records
    .map((record) => {
      const parts = [`user_id.eq.${eqFilter(userId)}`];
      for (const key of primaryKeys) {
        parts.push(`${key}.eq.${eqFilter(record[key])}`);
      }
      return `and(${parts.join(',')})`;
    })
    .join(',');
  query.set('or', `(${clauses})`);
  const existing = await supabaseRest(env, token, `${table}?${query.toString()}`);
  return new Map((existing || []).map((record) => [recordKey(record, primaryKeys), record]));
}

async function upsertBatch(env, token, table, dbRecords, primaryKeys) {
  if (dbRecords.length === 0) return [];
  const query = new URLSearchParams();
  query.set('on_conflict', ['user_id', ...primaryKeys].join(','));
  const inserted = await supabaseRest(env, token, `${table}?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(dbRecords),
  });
  return (inserted || dbRecords).map((record) => normalizeRecord(table, record));
}

async function upsertRecords(env, token, user, table, records, primaryKeys) {
  const transform = tableTransforms[table];
  const authoritative = [];
  const batchSize = 100;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize).map((record) => transform(record, user.id));
    const existingRecords = await fetchExistingBatch(
      env,
      token,
      table,
      user.id,
      batch,
      primaryKeys,
    );
    const toUpsert = [];

    for (const dbRecord of batch) {
      const key = recordKey(dbRecord, primaryKeys);
      const existing = existingRecords.get(key);

      if (!existing || recordIsNewer(dbRecord, existing)) {
        toUpsert.push(dbRecord);
      } else {
        authoritative.push(normalizeRecord(table, existing));
      }
    }

    authoritative.push(...(await upsertBatch(env, token, table, toUpsert, primaryKeys)));
  }

  return authoritative;
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  const { user, token } = auth;

  try {
    const body = await request.json();
    const [books, configs, notes] = await Promise.all([
      upsertRecords(env, token, user, 'books', body.books || [], ['book_hash']),
      upsertRecords(env, token, user, 'book_configs', body.configs || [], ['book_hash']),
      upsertRecords(env, token, user, 'book_notes', body.notes || [], ['book_hash', 'id']),
    ]);

    return json({ books, configs, notes });
  } catch (error) {
    return json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
