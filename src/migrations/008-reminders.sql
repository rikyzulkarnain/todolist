-- Jenis pengingat per task (PRD §5 tabel reminders, disederhanakan sebagai
-- kolom pada tasks agar cocok dengan model task-centric aplikasi ini):
--   none  = tanpa pengingat
--   push  = notifikasi biasa (Notification API) saat due_time tiba
--   alarm = layar penuh + bunyi berulang sampai di-acknowledge (§9.4/§11)
--
-- Default 'push' supaya task berwaktu yang sudah ada langsung mengingatkan.
-- Task tanpa due_time tidak pernah menjadwalkan pengingat (dicek di klien).

alter table public.tasks
  add column if not exists reminder text not null default 'push'
  check (reminder in ('none', 'push', 'alarm'));
