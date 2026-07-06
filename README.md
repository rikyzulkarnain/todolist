# AI Life OS

*Personal operating system* — selalu tahu apa yang harus dikerjakan sekarang.
Implementasi dari desain Claude Design (`design-dari-file-prd/`) dan
`PRD-AI-Life-OS-v2.md`, mengikuti struktur & konvensi proyek `pelatihku`.

## Fitur (MVP)

- **Auth** — magic link (email) + Google OAuth via Supabase.
- **Onboarding 4 langkah** — izin notifikasi, 1–3 goal, jam produktif, task pertama.
- **Home** — greeting, kartu **Fokus Hari Ini** (top-3 + progress), jadwal hari
  ini, reminder in-app (Selesai / Snooze 15m / Jadwalkan ulang).
- **Tugas** — kelompok per Life Area / Prioritas / Jatuh tempo, checkbox, chip warna.
  Tap kartu → **sheet detail**: edit judul/catatan, pindah Life Area, prioritas,
  ubah tanggal & waktu, **subtask** (checklist), **tag** (many-to-many), **ulang**
  (harian/mingguan/bulanan — kemunculan berikutnya dibuat otomatis saat selesai),
  **pengingat** (Tidak / Notifikasi / Alarm), dan hapus. FAB tambah tugas juga
  punya **input suara** (dikte judul via transkrip Gemini) + waktu & pengingat.
- **Pengingat (PWA)** — service worker + penjadwal *foreground*: saat `due_time`
  tiba, task tipe **Notifikasi** memunculkan notifikasi sistem, task tipe
  **Alarm** memicu **layar penuh berbunyi** (Web Audio + getar) sampai
  di-*acknowledge* (Selesai / Tunda 5m / Matikan) — fallback web sesuai §11 PRD.
  Notifikasi diaktifkan dari onboarding atau kartu di Profil. *(Notifikasi saat
  app tertutup total butuh web push server/VAPID — handler `push` sudah disiapkan
  di `public/sw.js` untuk pengembangan berikutnya.)*
- **Web Push server-side (opsional)** — Edge Function `send-reminders` (cron
  tiap menit) mengirim notifikasi walau app tertutup, via VAPID + tabel
  `push_subscriptions`. Setup: `supabase/functions/send-reminders/README.md`.
- **Kalender** — strip 7 hari + tampilan **Harian / Mingguan / Bulanan** (grid
  bulan dengan titik per Life Area, tap tanggal → task hari itu). Tap task →
  sheet detail.
- **Refleksi harian** — mood 1–5 + catatan (1 per hari), dari kartu di Home.
- **Tinjauan mingguan** — statistik penyelesaian task, breakdown per Life Area,
  hari produktif, mood rata-rata, insight *rule-based*, dan tombol **Insight AI**
  (narasi Gemini on-demand, hemat kuota).
- **Goals (Goal Tree)** — tujuan besar → **milestone** (nested), progress dari
  task terkait (`tasks.goal_id`), tandai selesai/hapus. Task bisa dikaitkan ke
  goal lewat sheet detail. Dari Profil → "Goals & milestone".
- **Long-term memory (RAG)** — catatan refleksi disimpan sebagai embedding di
  `ai_memory`; asisten AI mengambil top-k memori relevan (`match_ai_memory`)
  untuk menjawab lebih personal (PRD §6.3).
- **Proactive AI nudge** — Edge Function `proactive-nudge` (cron/jam) mengirim
  dorongan kontekstual (deadline, overload, ajakan refleksi) dengan frequency
  cap + jam tenang (PRD §6.5). Setup: `supabase/functions/proactive-nudge/`.
- **Timezone per user** — `profiles.timezone` (dari browser) dipakai untuk
  hitung "hari ini"/jam di server (review, konteks AI, nudge).
- **Couple / Family Mode** — ruang berbagi (`/couple`, dari Profil): buat ruang
  (Berdua/Keluarga) → bagikan **kode undangan** → anggota bergabung. **Task
  berbagi** (dengan tanggal & jam, muncul di Tugas & Kalender tiap anggota dan
  mengingatkan semua) & **daftar belanja** tersinkron **real-time** (Supabase
  Realtime). RLS "pemilik ATAU anggota space" (`is_space_member()`); task/goal
  pribadi tetap privat (`space_id` null).
- **Integrasi Telegram (v3)** — bot dua arah (`supabase/functions/telegram-webhook`):
  hubungkan akun dari Profil (deep link), buat task dari chat, `/today` untuk
  daftar hari ini, dan terima **reminder di Telegram**. Setup di README fungsi.
- **Integrasi Google Calendar (v3)** — OAuth dari Profil; sinkron **dua arah**:
  task bertanggal di app otomatis jadi event kalender (buat/ubah/hapus), dan
  event Google Calendar diimpor jadi task (otomatis saat connect + tombol
  **Sinkron**), dipetakan lewat `tasks.gcal_event_id` tanpa duplikat. Token
  disimpan di tabel RLS default-deny (hanya server via service role). Butuh
  Client ID/Secret di env + redirect URI `/api/google/callback` terdaftar di
  Google Cloud.
- **Asisten AI (Gemini)** — chat berbahasa Indonesia dengan *function calling*:
  - `propose_agenda` → kartu **"Agenda prioritasmu hari ini"** ("Saya bingung hari ini")
  - `create_task` / `complete_task` / `delete_task` dari teks, **suara**
    (transkrip Gemini), dan **foto** (OCR whiteboard/catatan/struk via vision)
  - `search_tasks` → **pencarian semantik** task via pgvector
    (`gemini-embedding-2` 768-dim + RPC `match_tasks`, pola dari fina-app);
    embedding dihitung otomatis saat task dibuat/dijadwalkan ulang
  - kuota harian Free 10 pesan + fallback antar model saat kena rate limit.
- **Profil** — kuota AI harian, kartu upgrade Pro, keluar.
- Empty / loading (skeleton) / offline state untuk tiap layar.

## Setup

1. `npm install`
2. Salin `.env.example` → `.env.local`, isi kredensial Supabase + Gemini
   (VAPID opsional, hanya untuk Web Push server-side).
3. Jalankan migrations `src/migrations/001–016` di Supabase SQL Editor
   (lihat `src/migrations/README.md`, termasuk setup magic link & Google OAuth).
4. `npm run dev`

## Struktur

```
public/            # sw.js (service worker notifikasi), manifest.webmanifest, icon.svg
supabase/functions/  # Edge Functions: send-reminders (Web Push + Telegram),
                     #   proactive-nudge, telegram-webhook
src/
├── app/            # App Router: (auth)/login, (onboarding),
│                   #   (app)/(tabs)/{home,calendar,ai,tasks,profile},
│                   #   (app)/{reflection,review,goals,couple}, api/google/*
├── components/common/  # bottom-nav, add-task-sheet (FAB), task-card, task-detail-sheet, reminder-scheduler, alarm-overlay, dst.
├── config/         # akses process.env terpusat
├── constants/      # life area, prioritas, model AI
├── features/       # server actions per domain: auth, tasks, tags, goals, reflection, review, push, space, telegram, google (Calendar), assistant (AI: chat/context/memory), ...
├── hooks/          # use-audio-recorder, use-online
├── lib/            # supabase (client/server/service/auth/proxy), notifications, push, time (tz)
├── migrations/     # SQL Supabase (RLS default-deny)
├── providers/      # react-query
├── stores/         # zustand (sheet, task-detail, alarm)
├── types/          # *.d.ts
└── validations/    # zod
```
