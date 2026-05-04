import {
  Book,
  BookConfig,
  BookFormat,
  BookNote,
  BookNoteType,
  HighlightColor,
  HighlightStyle,
  ReadingStatus,
} from '@/types/book';
import { DBBookConfig, DBBook, DBBookNote } from '@/types/records';
import { sanitizeString } from './sanitize';

const parseJsonish = <T>(value: unknown): T | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
};

export const transformBookConfigToDB = (bookConfig: unknown, userId: string): DBBookConfig => {
  const {
    bookHash,
    metaHash,
    progress,
    location,
    xpointer,
    rsvpPosition,
    searchConfig,
    viewSettings,
    updatedAt,
  } = bookConfig as BookConfig;

  return {
    user_id: userId,
    book_hash: bookHash!,
    meta_hash: metaHash,
    location: location,
    xpointer: xpointer,
    progress: progress && JSON.stringify(progress),
    rsvp_position: rsvpPosition && JSON.stringify(rsvpPosition),
    search_config: searchConfig && JSON.stringify(searchConfig),
    view_settings: viewSettings && JSON.stringify(viewSettings),
    updated_at: new Date(updatedAt ?? Date.now()).toISOString(),
  };
};

export const transformBookConfigFromDB = (dbBookConfig: DBBookConfig): BookConfig => {
  const {
    book_hash,
    meta_hash,
    progress,
    location,
    xpointer,
    rsvp_position,
    search_config,
    view_settings,
    updated_at,
  } = dbBookConfig;
  return {
    bookHash: book_hash,
    metaHash: meta_hash,
    location,
    xpointer,
    progress: parseJsonish(progress),
    rsvpPosition: parseJsonish(rsvp_position),
    searchConfig: parseJsonish(search_config),
    viewSettings: parseJsonish(view_settings),
    updatedAt: new Date(updated_at!).getTime(),
  } as BookConfig;
};

export const transformBookToDB = (book: unknown, userId: string): DBBook => {
  const {
    hash,
    metaHash,
    format,
    title,
    sourceTitle,
    author,
    groupId,
    groupName,
    tags,
    progress,
    readingStatus,
    metadata,
    createdAt,
    updatedAt,
    deletedAt,
    uploadedAt,
  } = book as Book;

  return {
    user_id: userId,
    book_hash: hash,
    meta_hash: metaHash,
    format,
    title: sanitizeString(title)!,
    author: sanitizeString(author)!,
    // Use `?? null` so cleared fields are propagated to the server. Without
    // this, JSON.stringify would drop undefined values from the upsert
    // payload — and PostgREST's "ON CONFLICT DO UPDATE" only updates
    // columns present in the INSERT list, so the server-side group_id /
    // group_name would silently retain their old values. The next pull
    // would then bring those stale values back, undoing "Remove From Group".
    group_id: groupId ?? null,
    group_name: sanitizeString(groupName) ?? null,
    tags: tags,
    progress: progress,
    reading_status: readingStatus,
    source_title: sanitizeString(sourceTitle),
    metadata: metadata ? sanitizeString(JSON.stringify(metadata)) : null,
    created_at: new Date(createdAt ?? Date.now()).toISOString(),
    updated_at: new Date(updatedAt ?? Date.now()).toISOString(),
    deleted_at: deletedAt ? new Date(deletedAt).toISOString() : null,
    uploaded_at: uploadedAt ? new Date(uploadedAt).toISOString() : null,
  };
};

export const transformBookFromDB = (dbBook: DBBook): Book => {
  const {
    book_hash,
    meta_hash,
    format,
    title,
    author,
    group_id,
    group_name,
    tags,
    progress,
    reading_status,
    source_title,
    metadata,
    created_at,
    updated_at,
    deleted_at,
    uploaded_at,
  } = dbBook;

  return {
    hash: book_hash,
    metaHash: meta_hash,
    format: format as BookFormat,
    title,
    author,
    // Normalize null back to undefined so internal Book objects stay
    // consistent with the type (groupId / groupName are `string | undefined`).
    // The DB schema allows null because we explicitly write null on clear
    // (see transformBookToDB) so PostgREST UPSERT actually wipes the column.
    groupId: group_id ?? undefined,
    groupName: group_name ?? undefined,
    tags: tags,
    progress: progress,
    readingStatus: reading_status as ReadingStatus,
    sourceTitle: source_title,
    metadata: parseJsonish(metadata),
    createdAt: new Date(created_at!).getTime(),
    updatedAt: new Date(updated_at!).getTime(),
    deletedAt: deleted_at ? new Date(deleted_at).getTime() : null,
    uploadedAt: uploaded_at ? new Date(uploaded_at).getTime() : null,
  };
};

export const transformBookNoteToDB = (bookNote: unknown, userId: string): DBBookNote => {
  const {
    bookHash,
    metaHash,
    id,
    type,
    cfi,
    xpointer0,
    xpointer1,
    page,
    text,
    style,
    color,
    note,
    createdAt,
    updatedAt,
    deletedAt,
  } = bookNote as BookNote;

  return {
    user_id: userId,
    book_hash: bookHash!,
    meta_hash: metaHash,
    id,
    type,
    cfi,
    xpointer0,
    xpointer1,
    page,
    text: sanitizeString(text),
    style,
    color,
    note,
    created_at: new Date(createdAt ?? Date.now()).toISOString(),
    updated_at: new Date(updatedAt ?? Date.now()).toISOString(),
    // note that only null deleted_at is updated to the database, undefined is not
    deleted_at: deletedAt ? new Date(deletedAt).toISOString() : null,
  };
};

export const transformBookNoteFromDB = (dbBookNote: DBBookNote): BookNote => {
  const {
    book_hash,
    meta_hash,
    id,
    type,
    cfi,
    xpointer0,
    xpointer1,
    page,
    text,
    style,
    color,
    note,
    created_at,
    updated_at,
    deleted_at,
  } = dbBookNote;

  return {
    bookHash: book_hash,
    metaHash: meta_hash,
    id,
    type: type as BookNoteType,
    cfi: cfi ?? '',
    xpointer0,
    xpointer1,
    page,
    text,
    style: style as HighlightStyle,
    color: color as HighlightColor,
    note,
    createdAt: new Date(created_at!).getTime(),
    updatedAt: new Date(updated_at!).getTime(),
    deletedAt: deleted_at ? new Date(deleted_at).getTime() : null,
  };
};
