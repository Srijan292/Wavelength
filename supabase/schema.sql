-- Run this whole file once in your Supabase project's SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run). It is safe to re-run.

-- ─────────────────────────────────────────────────────────
-- 1. Songs table
-- ─────────────────────────────────────────────────────────
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  artist text,
  album text,
  duration double precision, -- seconds
  storage_path text not null, -- path inside the "songs" storage bucket
  thumbnail_path text, -- path inside the "thumbnails" bucket (used from Phase 2 on)
  created_at timestamptz not null default now()
);

create index if not exists songs_user_id_idx on public.songs (user_id);

alter table public.songs enable row level security;

drop policy if exists "Users can view their own songs" on public.songs;
create policy "Users can view their own songs"
  on public.songs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own songs" on public.songs;
create policy "Users can insert their own songs"
  on public.songs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own songs" on public.songs;
create policy "Users can update their own songs"
  on public.songs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own songs" on public.songs;
create policy "Users can delete their own songs"
  on public.songs for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- 2. Storage buckets
--    "songs" is private: audio is only reachable through short-lived signed
--    URLs created for the owning user.
--    "thumbnails" is public-read (cover art is not sensitive); it is used
--    from Phase 2 on, when custom thumbnails ship.
-- ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('songs', 'songs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Files are stored as "<user_id>/<filename>", so the first folder name is the owner.

drop policy if exists "Users can upload songs to their own folder" on storage.objects;
create policy "Users can upload songs to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read their own songs" on storage.objects;
create policy "Users can read their own songs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own songs" on storage.objects;
create policy "Users can delete their own songs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload thumbnails to their own folder" on storage.objects;
create policy "Users can upload thumbnails to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Anyone can view thumbnails" on storage.objects;
create policy "Anyone can view thumbnails"
  on storage.objects for select
  to public
  using (bucket_id = 'thumbnails');
