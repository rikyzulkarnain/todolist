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
  hari produktif, mood rata-rata, dan insight *rule-based* (PRD §6.4).
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
3. Jalankan migrations `src/migrations/001–010` di Supabase SQL Editor
   (lihat `src/migrations/README.md`, termasuk setup magic link & Google OAuth).
4. `npm run dev`

## Struktur

```
public/            # sw.js (service worker notifikasi), manifest.webmanifest, icon.svg
supabase/functions/send-reminders/  # Edge Function Web Push (VAPID + cron)
src/
├── app/            # App Router: (auth)/login, (onboarding),
│                   #   (app)/(tabs)/{home,calendar,ai,tasks,profile},
│                   #   (app)/{reflection,review}
├── components/common/  # bottom-nav, add-task-sheet (FAB), task-card, task-detail-sheet, reminder-scheduler, alarm-overlay, dst.
├── config/         # akses process.env terpusat
├── constants/      # life area, prioritas, model AI
├── features/       # server actions per domain: auth, tasks, tags, reflection, review, push, assistant (AI), ...
├── hooks/          # use-audio-recorder, use-online
├── lib/            # supabase (client/server/auth/proxy), notifications, push (Web Push)
├── migrations/     # SQL Supabase (RLS default-deny)
├── providers/      # react-query
├── stores/         # zustand (sheet, task-detail, alarm)
├── types/          # *.d.ts
└── validations/    # zod
```
