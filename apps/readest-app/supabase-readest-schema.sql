create table if not exists public.books (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_hash text not null,
  meta_hash text null,
  format text null,
  title text null,
  source_title text null,
  author text null,
  "group" text null,
  tags text[] null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  uploaded_at timestamp with time zone null,
  progress integer[] null,
  reading_status text null,
  group_id text null,
  group_name text null,
  metadata json null,
  constraint books_pkey primary key (user_id, book_hash)
);

create table if not exists public.book_configs (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_hash text not null,
  meta_hash text null,
  location text null,
  xpointer text null,
  progress jsonb null,
  rsvp_position text null,
  search_config jsonb null,
  view_settings jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint book_configs_pkey primary key (user_id, book_hash)
);

create table if not exists public.book_notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_hash text not null,
  meta_hash text null,
  id text not null,
  type text null,
  cfi text null,
  xpointer0 text null,
  xpointer1 text null,
  text text null,
  style text null,
  color text null,
  note text null,
  page integer null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint book_notes_pkey primary key (user_id, book_hash, id)
);

create table if not exists public.files (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_hash text null,
  file_key text not null,
  file_size bigint not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  deleted_at timestamp with time zone null,
  constraint files_pkey primary key (id),
  constraint files_file_key_key unique (file_key)
);

create index if not exists idx_files_user_id_deleted_at on public.files (user_id, deleted_at);
create index if not exists idx_files_file_key on public.files (file_key);
create index if not exists idx_files_file_key_deleted_at on public.files (file_key, deleted_at);

alter table public.books enable row level security;
alter table public.book_configs enable row level security;
alter table public.book_notes enable row level security;
alter table public.files enable row level security;

drop policy if exists select_books on public.books;
drop policy if exists insert_books on public.books;
drop policy if exists update_books on public.books;
drop policy if exists delete_books on public.books;
create policy select_books on public.books for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_books on public.books for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_books on public.books for update to authenticated using ((select auth.uid()) = user_id);
create policy delete_books on public.books for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists select_book_configs on public.book_configs;
drop policy if exists insert_book_configs on public.book_configs;
drop policy if exists update_book_configs on public.book_configs;
drop policy if exists delete_book_configs on public.book_configs;
create policy select_book_configs on public.book_configs for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_book_configs on public.book_configs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_book_configs on public.book_configs for update to authenticated using ((select auth.uid()) = user_id);
create policy delete_book_configs on public.book_configs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists select_book_notes on public.book_notes;
drop policy if exists insert_book_notes on public.book_notes;
drop policy if exists update_book_notes on public.book_notes;
drop policy if exists delete_book_notes on public.book_notes;
create policy select_book_notes on public.book_notes for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_book_notes on public.book_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_book_notes on public.book_notes for update to authenticated using ((select auth.uid()) = user_id);
create policy delete_book_notes on public.book_notes for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists files_insert on public.files;
drop policy if exists files_select on public.files;
drop policy if exists files_update on public.files;
drop policy if exists files_delete on public.files;
create policy files_insert on public.files for insert to authenticated with check ((select auth.uid()) = user_id);
create policy files_select on public.files for select to authenticated using ((select auth.uid()) = user_id and deleted_at is null);
create policy files_update on public.files for update to authenticated using ((select auth.uid()) = user_id) with check (deleted_at is null or deleted_at > now());
create policy files_delete on public.files for delete to authenticated using ((select auth.uid()) = user_id);

grant all on public.books to authenticated;
grant all on public.book_configs to authenticated;
grant all on public.book_notes to authenticated;
grant all on public.files to authenticated;
