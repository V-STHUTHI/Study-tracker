create extension if not exists pgcrypto;

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  invite_code text not null unique default upper(encode(gen_random_bytes(16), 'hex')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.study_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  date date not null,
  subject text not null check (length(trim(subject)) between 1 and 60),
  topic text not null check (length(trim(topic)) between 1 and 100),
  minutes smallint not null check (minutes between 1 and 1440),
  tests integer not null default 0 check (tests >= 0),
  problems integer not null default 0 check (problems >= 0),
  notes text not null default '' check (length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists study_entries_group_date_idx
  on public.study_entries (group_id, date desc, created_at desc);

create or replace function public.is_study_group_member(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.study_group_members
    where group_id = target_group and user_id = auth.uid()
  );
$$;

create or replace function public.current_study_group_name(target_group uuid)
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select display_name
  from public.study_group_members
  where group_id = target_group and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.create_study_group(p_group_name text, p_display_name text)
returns table (group_id uuid, group_name text, invite_code text)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  created_group public.study_groups;
begin
  if auth.uid() is null then
    raise exception 'Sign in before creating a study group';
  end if;
  if length(trim(coalesce(p_group_name, ''))) not between 1 and 60 then
    raise exception 'Workspace name must be between 1 and 60 characters';
  end if;
  if length(trim(coalesce(p_display_name, ''))) not between 1 and 40 then
    raise exception 'Your name must be between 1 and 40 characters';
  end if;
  if exists (select 1 from public.study_group_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a study workspace';
  end if;

  insert into public.study_groups (name) values (trim(p_group_name))
  returning * into created_group;
  insert into public.study_group_members (group_id, user_id, display_name)
  values (created_group.id, auth.uid(), trim(p_display_name));

  return query select created_group.id, created_group.name, created_group.invite_code;
end;
$$;

create or replace function public.join_study_group(p_invite_code text, p_display_name text)
returns table (group_id uuid, group_name text, invite_code text)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  target public.study_groups;
  existing_group uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before joining a study group';
  end if;
  if length(trim(coalesce(p_display_name, ''))) not between 1 and 40 then
    raise exception 'Your name must be between 1 and 40 characters';
  end if;

  select * into target from public.study_groups
  where invite_code = upper(trim(coalesce(p_invite_code, '')));
  if not found then
    raise exception 'That invite code was not found';
  end if;

  select group_id into existing_group from public.study_group_members
  where user_id = auth.uid();
  if existing_group is not null and existing_group <> target.id then
    raise exception 'This account already belongs to another study workspace';
  end if;

  insert into public.study_group_members (group_id, user_id, display_name)
  values (target.id, auth.uid(), trim(p_display_name))
  on conflict (user_id) do update set display_name = excluded.display_name;

  return query select target.id, target.name, target.invite_code;
end;
$$;

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.study_entries enable row level security;

grant select on public.study_groups to authenticated;
grant select on public.study_group_members to authenticated;
grant select, insert, update, delete on public.study_entries to authenticated;

drop policy if exists "Members can view their group" on public.study_groups;
create policy "Members can view their group" on public.study_groups
  for select to authenticated using (public.is_study_group_member(id));

drop policy if exists "Users can view their membership" on public.study_group_members;
create policy "Users can view their membership" on public.study_group_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Members can view group study entries" on public.study_entries;
create policy "Members can view group study entries" on public.study_entries
  for select to authenticated using (public.is_study_group_member(group_id));

drop policy if exists "Members can add their own study entries" on public.study_entries;
create policy "Members can add their own study entries" on public.study_entries
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_study_group_member(group_id)
    and display_name = public.current_study_group_name(group_id)
  );

drop policy if exists "Members can update their own study entries" on public.study_entries;
create policy "Members can update their own study entries" on public.study_entries
  for update to authenticated
  using (user_id = auth.uid() and public.is_study_group_member(group_id))
  with check (
    user_id = auth.uid()
    and public.is_study_group_member(group_id)
    and display_name = public.current_study_group_name(group_id)
  );

drop policy if exists "Members can delete their own study entries" on public.study_entries;
create policy "Members can delete their own study entries" on public.study_entries
  for delete to authenticated using (user_id = auth.uid() and public.is_study_group_member(group_id));

revoke all on function public.is_study_group_member(uuid) from public;
revoke all on function public.current_study_group_name(uuid) from public;
revoke all on function public.create_study_group(text, text) from public;
revoke all on function public.join_study_group(text, text) from public;
grant execute on function public.is_study_group_member(uuid) to authenticated;
grant execute on function public.current_study_group_name(uuid) to authenticated;
grant execute on function public.create_study_group(text, text) to authenticated;
grant execute on function public.join_study_group(text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'study_entries'
    ) then
    alter publication supabase_realtime add table public.study_entries;
  end if;
end;
$$;