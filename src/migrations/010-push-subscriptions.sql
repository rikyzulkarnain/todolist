-- Langganan Web Push (VAPID) per perangkat, untuk notifikasi reminder saat
-- app tertutup. Dikirim oleh Edge Function `send-reminders` (cron).
-- `endpoint` unik per subscription (kunci upsert dari klien).
create table public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Klien hanya boleh mengelola langganannya sendiri. Edge Function memakai
-- service role key sehingga melewati RLS untuk mengirim ke semua user.
create policy "own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kolom penanda agar reminder tidak dikirim dua kali oleh cron. Diisi Edge
-- Function saat sebuah task sudah dikirimi notifikasi push.
alter table public.tasks
  add column if not exists reminder_sent_at timestamp with time zone;
