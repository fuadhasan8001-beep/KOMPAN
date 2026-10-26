-- Jalankan satu kali pada Supabase SQL Editor.
-- Skema ini hanya memakai publishable/anon key di browser; service_role tidak dipakai.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user'))
);

alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', policy_row.policyname);
  end loop;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null,
  date date not null default current_date,
  category text not null default 'Artikel',
  author text not null default 'KOMPAN',
  image text not null default '',
  tags text[] not null default '{}',
  status text not null default 'published',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.articles add column if not exists excerpt text not null default '';
alter table public.articles add column if not exists content text not null default '';
alter table public.articles add column if not exists date date not null default current_date;
alter table public.articles add column if not exists category text not null default 'Artikel';
alter table public.articles add column if not exists author text not null default 'KOMPAN';
alter table public.articles add column if not exists image text not null default '';
alter table public.articles add column if not exists tags text[] not null default '{}';
alter table public.articles add column if not exists status text not null default 'published';
alter table public.articles add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.articles add column if not exists created_at timestamptz not null default now();
create unique index if not exists articles_slug_unique_idx on public.articles (slug);
create index if not exists articles_published_created_idx on public.articles (status, created_at desc);

alter table public.articles enable row level security;
revoke all on table public.articles from anon, authenticated;
grant select on table public.articles to anon, authenticated;
grant insert, update, delete on table public.articles to authenticated;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'articles'
  loop
    execute format('drop policy %I on public.articles', policy_row.policyname);
  end loop;
end;
$$;

drop policy if exists "articles_read_published" on public.articles;
create policy "articles_read_published"
  on public.articles for select to anon, authenticated
  using (status = 'published');

drop policy if exists "articles_admin_read_all" on public.articles;
create policy "articles_admin_read_all"
  on public.articles for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "articles_admin_insert" on public.articles;
create policy "articles_admin_insert"
  on public.articles for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));

drop policy if exists "articles_admin_update" on public.articles;
create policy "articles_admin_update"
  on public.articles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "articles_admin_delete" on public.articles;
create policy "articles_admin_delete"
  on public.articles for delete to authenticated
  using ((select public.is_admin()));

insert into public.profiles (id, role)
select id, 'admin'
from auth.users
where id = '035631b3-63ea-48fd-88e1-9da7c432a3f0'::uuid
on conflict (id) do update set role = 'admin';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kompan-media', 'kompan-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies apply to the shared storage.objects table; replace existing
-- policies so no broad upload rule can bypass the admin check for this bucket.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', policy_row.policyname);
  end loop;
end;
$$;

drop policy if exists "kompan_media_public_read" on storage.objects;
create policy "kompan_media_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'kompan-media');

drop policy if exists "kompan_media_admin_insert" on storage.objects;
create policy "kompan_media_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kompan-media' and (select public.is_admin()));

drop policy if exists "kompan_media_admin_update" on storage.objects;
create policy "kompan_media_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'kompan-media' and (select public.is_admin()))
  with check (bucket_id = 'kompan-media' and (select public.is_admin()));

drop policy if exists "kompan_media_admin_delete" on storage.objects;
create policy "kompan_media_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'kompan-media' and (select public.is_admin()));
