-- Tags (label bebas per user) + relasi many-to-many ke tasks.
-- Melengkapi task management MVP (§9.2 PRD: "tag").

create table public.tags (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Satu user tidak boleh punya dua tag dengan nama sama.
  unique (user_id, name)
);

alter table public.tags enable row level security;

create policy "own tags" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Relasi task ↔ tag. user_id ikut disimpan agar RLS bisa langsung memeriksa
-- kepemilikan tanpa join ke tasks/tags.
create table public.task_tags (
  task_id uuid references public.tasks(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  primary key (task_id, tag_id)
);

create index task_tags_task_idx on public.task_tags (task_id);

alter table public.task_tags enable row level security;

create policy "own task_tags" on public.task_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
