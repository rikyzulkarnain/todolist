-- ============================================================
-- Profil pengguna (mirrors pelatihku profiles)
-- ============================================================
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  name text,
  email text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  productive_time text
    check (productive_time in ('Pagi', 'Siang', 'Malam')),
  onboarding_completed boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- Seed profil dari raw_user_meta_data saat signup (magic link / Google)
-- ============================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'name',
                   new.raw_user_meta_data ->> 'full_name'),
          new.email,
          new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.handle_delete_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute procedure public.handle_delete_user();
