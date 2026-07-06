-- ============================================================
-- Couple Mode (v2, PRD §5 & §10) — ruang berbagi task/goal/kalender + shopping.
-- Family Mode (v3) memakai struktur sama dengan type='family' + role='child'.
-- ============================================================

-- Ruang berbagi. invite_code dipakai anggota untuk bergabung.
create table public.shared_spaces (
  id uuid default gen_random_uuid() primary key,
  type text not null default 'couple' check (type in ('couple', 'family')),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Keanggotaan + peran + izin granular. display_name di-denormalisasi agar tak
-- perlu membaca profil anggota lain (RLS profiles = own-only).
create table public.space_members (
  space_id uuid references public.shared_spaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'member', 'child')),
  display_name text,
  permissions jsonb not null
    default '{"can_edit_shared_tasks": true, "can_view_calendar": true}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (space_id, user_id)
);

create index space_members_user_idx on public.space_members (user_id);

-- Daftar belanja bersama (PRD §10).
create table public.shopping_items (
  id uuid default gen_random_uuid() primary key,
  space_id uuid references public.shared_spaces(id) on delete cascade not null,
  name text not null,
  checked boolean not null default false,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index shopping_items_space_idx on public.shopping_items (space_id);

-- Task & goal bisa dibagikan ke sebuah space (null = pribadi).
alter table public.tasks
  add column if not exists space_id uuid
    references public.shared_spaces(id) on delete set null;
alter table public.goals
  add column if not exists space_id uuid
    references public.shared_spaces(id) on delete set null;

create index if not exists tasks_space_idx on public.tasks (space_id);
create index if not exists goals_space_idx on public.goals (space_id);

-- ============================================================
-- Helper SECURITY DEFINER — cek keanggotaan tanpa memicu rekursi RLS.
-- ============================================================
create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$;

-- Bergabung ke space lewat kode undangan (SECURITY DEFINER: pelamar belum jadi
-- anggota sehingga tak bisa SELECT space via RLS). Mengembalikan id space.
create or replace function public.join_space_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_name text;
begin
  select id into v_space_id
  from public.shared_spaces
  where invite_code = upper(p_code);

  if v_space_id is null then
    raise exception 'Kode undangan tidak valid';
  end if;

  select coalesce(name, split_part(email, '@', 1))
  into v_name
  from public.profiles
  where id = auth.uid();

  insert into public.space_members (space_id, user_id, role, display_name)
  values (v_space_id, auth.uid(), 'member', v_name)
  on conflict (space_id, user_id) do nothing;

  return v_space_id;
end;
$$;

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.shared_spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.shopping_items enable row level security;

-- shared_spaces: anggota bisa lihat; pembuat mengelola.
create policy "member sees space" on public.shared_spaces
  for select using (public.is_space_member(id));
create policy "creator manages space" on public.shared_spaces
  for all using (created_by = auth.uid()) with check (created_by = auth.uid());

-- space_members: anggota lihat sesama anggota; tiap user kelola barisnya sendiri.
create policy "see space members" on public.space_members
  for select using (public.is_space_member(space_id));
create policy "manage own membership" on public.space_members
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- shopping_items: semua anggota space boleh baca-tulis.
create policy "space shopping items" on public.shopping_items
  for all using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

-- ============================================================
-- Perluas RLS tasks & goals: pemilik ATAU anggota space terkait.
-- ============================================================
drop policy if exists "own tasks" on public.tasks;
create policy "own or shared tasks" on public.tasks
  for all
  using (
    auth.uid() = user_id
    or (space_id is not null and public.is_space_member(space_id))
  )
  with check (
    auth.uid() = user_id
    or (space_id is not null and public.is_space_member(space_id))
  );

drop policy if exists "own goals" on public.goals;
create policy "own or shared goals" on public.goals
  for all
  using (
    auth.uid() = user_id
    or (space_id is not null and public.is_space_member(space_id))
  )
  with check (
    auth.uid() = user_id
    or (space_id is not null and public.is_space_member(space_id))
  );

-- ============================================================
-- Realtime: siarkan perubahan data berbagi (aktifkan replikasi).
-- ============================================================
alter publication supabase_realtime add table public.shopping_items;
alter publication supabase_realtime add table public.tasks;
