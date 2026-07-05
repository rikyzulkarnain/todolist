-- Log nudge proaktif untuk frequency cap (PRD §6.5: maks beberapa nudge/hari,
-- hormati jam tenang). Diisi Edge Function `proactive-nudge`.
create table public.ai_nudges (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null, -- 'deadline' | 'overload' | 'rest' | 'reflection' | ...
  message text not null,
  ref_id uuid, -- task terkait bila ada
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index ai_nudges_user_created_idx on public.ai_nudges (user_id, created_at);

alter table public.ai_nudges enable row level security;

-- User boleh membaca nudge-nya sendiri. Edge Function (service role) melewati
-- RLS untuk menulis & mengevaluasi lintas user.
create policy "own ai_nudges" on public.ai_nudges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
