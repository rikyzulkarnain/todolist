# Migrations

Jalankan berurutan (001 → 014) di Supabase SQL Editor:

1. `001-extensions.sql` — uuid + pgvector
2. `002-auth-profiles.sql` — profil + trigger signup
3. `003-goals.sql` — goal onboarding
4. `004-tasks.sql` — task inti MVP
5. `005-assistant.sql` — percakapan AI + ai_memory (RAG v2)
6. `006-tasks-embeddings.sql` — kolom `tasks.embedding vector(768)` + fungsi
   `match_tasks` untuk pencarian semantik (pola dari fina-app:
   *Transactions Table with Vector Embeddings & RLS* + *Semantic Transaction
   Matching Function*). Embedding dihitung otomatis saat task dibuat /
   dijadwalkan ulang — task lama yang belum punya embedding tetap aman
   (fungsi melewati baris `embedding IS NULL`).
7. `007-tags.sql` — tabel `tags` + `task_tags` (many-to-many) untuk fitur tag
   pada task management MVP (§9.2 PRD), dengan RLS default-deny.
8. `008-reminders.sql` — kolom `tasks.reminder` (`none|push|alarm`) untuk jenis
   pengingat (§9.4/§11 PRD). Default `push` sehingga task berwaktu yang sudah
   ada langsung mengingatkan.
9. `009-reflections.sql` — tabel `reflections` (mood 1–5 + catatan, 1 baris per
   hari) untuk refleksi harian & weekly review (v1.1 PRD §5).
10. `010-push-subscriptions.sql` — tabel `push_subscriptions` + kolom
    `tasks.reminder_sent_at` untuk Web Push server-side. Setup lengkap ada di
    `supabase/functions/send-reminders/README.md`.
11. `011-user-timezone.sql` — kolom `profiles.timezone` (IANA) untuk hitung
    tanggal/jam di server per user (weekly review, konteks AI, nudge).
12. `012-ai-memory-rpc.sql` — fungsi `match_ai_memory` (pgvector) untuk RAG
    long-term memory (PRD §6.3).
13. `013-proactive-nudges.sql` — tabel `ai_nudges` (frequency cap nudge proaktif,
    PRD §6.5). Edge Function di `supabase/functions/proactive-nudge/README.md`.
14. `014-couple-mode.sql` — Couple Mode (PRD §5 & §10): `shared_spaces`,
    `space_members`, `shopping_items`, kolom `space_id` di tasks/goals, fungsi
    `is_space_member()`/`join_space_by_code()`, dan RLS "pemilik ATAU anggota
    space". Juga menambah `shopping_items` + `tasks` ke publication
    `supabase_realtime` (sinkron real-time). Jalankan **sekali** — `alter
    publication ... add table` error bila tabel sudah terdaftar.

Semua tabel memakai Row-Level Security dengan kebijakan *default deny* —
pengguna hanya bisa membaca/menulis baris miliknya sendiri.

## Auth

Aktifkan di Supabase Dashboard → Authentication:

- **Email (magic link)** — Sign in with OTP.
- **Google OAuth** — isi Client ID/Secret, tambahkan redirect
  `https://<project>.supabase.co/auth/v1/callback`.
- Tambahkan `http://localhost:3000/auth/callback` ke Redirect URLs.
