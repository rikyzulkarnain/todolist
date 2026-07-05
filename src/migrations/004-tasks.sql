-- Task inti MVP. due_date + due_time dipisah agar mudah dikelompokkan di
-- Calendar (harian/mingguan) tanpa hitung timezone di query.
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  goal_id uuid references public.goals(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  notes text,
  life_area text not null default 'Pribadi'
    check (life_area in ('Karier', 'Kesehatan', 'Keuangan', 'Keluarga', 'Ibadah', 'Belajar', 'Pribadi')),
  priority text not null default 'sedang'
    check (priority in ('urgent', 'tinggi', 'sedang', 'rendah')),
  due_date date,
  due_time text, -- 'HH:mm', null = fleksibel
  repeat_rule text, -- RRULE string (v1.1)
  status text not null default 'todo' check (status in ('todo', 'done')),
  completed_at timestamp with time zone,
  source text not null default 'manual'
    check (source in ('manual', 'voice', 'ocr', 'ai')),
  -- Alasan singkat dari AI kenapa task ini diprioritaskan ("Fokus Hari Ini").
  ai_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index tasks_user_due_idx on public.tasks (user_id, due_date);

alter table public.tasks enable row level security;

create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
