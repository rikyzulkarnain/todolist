-- Percakapan asisten AI (mirrors pelatihku coach). Kolom agenda menyimpan
-- kartu "Agenda prioritasmu hari ini" (JSON) agar bisa dirender ulang.
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.conversations enable row level security;

create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null, -- denormalized for RLS
  role text not null check (role in ('user', 'model')),
  content text not null,
  agenda jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at);

alter table public.chat_messages enable row level security;

create policy "own chat_messages" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Long-term memory (RAG, v2) — disiapkan sesuai PRD §5.
create table public.ai_memory (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  embedding vector(768),
  kind text check (kind in ('habit', 'preference', 'event', 'insight')),
  source_ref text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ai_memory enable row level security;

create policy "own ai_memory" on public.ai_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
