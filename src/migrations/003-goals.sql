-- Goal besar pengguna (dikumpulkan saat onboarding; Goal Tree menyusul di v2
-- lewat parent_goal_id).
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  parent_goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  description text,
  life_area text
    check (life_area in ('Karier', 'Kesehatan', 'Keuangan', 'Keluarga', 'Ibadah', 'Belajar', 'Pribadi')),
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  target_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.goals enable row level security;

create policy "own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
