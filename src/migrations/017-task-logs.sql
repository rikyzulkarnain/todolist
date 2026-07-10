-- Log Kegiatan per task (v3.1). Timeline dokumentasi apa yang SUDAH dilakukan
-- pengguna pada sebuah task: catatan teks (opsional) + lampiran multimodal
-- foto & suara. Transkrip suara disimpan agar bisa dibaca AI sebagai referensi
-- saat menyusun jadwal berikutnya ("kemarin sudah ngapain → besok lanjut apa").
create table public.task_logs (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  note text, -- catatan bebas dari pengguna (opsional)
  photo_path text, -- path objek di bucket 'task-logs' (opsional)
  audio_path text, -- path rekaman suara di bucket 'task-logs' (opsional)
  transcript text, -- hasil transkrip suara (diisi AI di latar belakang)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ambil log terbaru dulu per task (timeline menurun).
create index task_logs_task_idx on public.task_logs (task_id, created_at desc);
-- Untuk konteks asisten: log terbaru milik user lintas task.
create index task_logs_user_idx on public.task_logs (user_id, created_at desc);

alter table public.task_logs enable row level security;

create policy "own task logs" on public.task_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Storage: bucket privat untuk lampiran log (foto & suara).
-- Struktur path: <user_id>/<task_id>/<uuid>.<ext> — folder pertama = user_id,
-- dipakai policy di bawah untuk membatasi akses hanya ke file milik sendiri.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('task-logs', 'task-logs', false)
on conflict (id) do nothing;

create policy "own task-log files read" on storage.objects
  for select using (
    bucket_id = 'task-logs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "own task-log files insert" on storage.objects
  for insert with check (
    bucket_id = 'task-logs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "own task-log files delete" on storage.objects
  for delete using (
    bucket_id = 'task-logs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
