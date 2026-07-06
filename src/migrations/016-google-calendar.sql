-- Integrasi Google Calendar (v3). Menyimpan token OAuth per user + memetakan
-- task ke event kalender. RLS DEFAULT DENY (tanpa policy) — token hanya boleh
-- diakses server lewat service role, tidak pernah dari klien.
create table public.google_calendar_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text not null,
  expiry timestamp with time zone,
  calendar_id text not null default 'primary',
  connected_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS aktif tanpa policy = tidak ada akses dari anon/user key (default deny).
-- Server memakai service role key (bypass RLS) untuk baca/tulis token.
alter table public.google_calendar_links enable row level security;

-- Peta task → event Google Calendar, agar update/hapus tersinkron.
alter table public.tasks
  add column if not exists gcal_event_id text;
