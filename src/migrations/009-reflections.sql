-- Refleksi harian (mood + catatan) — v1.1 PRD §5. Satu baris per user per hari.
create table public.reflections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  mood smallint not null check (mood between 1 and 5),
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, date)
);

create index reflections_user_date_idx on public.reflections (user_id, date);

alter table public.reflections enable row level security;

create policy "own reflections" on public.reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
