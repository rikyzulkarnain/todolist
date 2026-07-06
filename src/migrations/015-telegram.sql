-- Integrasi Telegram (v3). Menghubungkan akun app ↔ chat Telegram lewat kode
-- undangan (deep link t.me/<bot>?start=<link_token>). Bot memakai service role
-- di Edge Function `telegram-webhook`.
create table public.telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint unique,
  username text,
  link_token text not null unique,
  linked boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.telegram_links enable row level security;

-- User hanya boleh mengelola tautannya sendiri; Edge Function (service role)
-- melewati RLS untuk memproses webhook.
create policy "own telegram link" on public.telegram_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
