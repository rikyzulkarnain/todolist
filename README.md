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
- **Kalender** — strip 7 hari + tampilan Harian & Mingguan.
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
2. Salin `.env.example` → `.env.local`, isi kredensial Supabase + Gemini.
3. Jalankan migrations `src/migrations/001–005` di Supabase SQL Editor
   (lihat `src/migrations/README.md`, termasuk setup magic link & Google OAuth).
4. `npm run dev`

## Struktur

```
src/
├── app/            # App Router: (auth)/login, (onboarding), (app)/(tabs)/{home,calendar,ai,tasks,profile}
├── components/common/  # bottom-nav, add-task-sheet (FAB), task-card, dst.
├── config/         # akses process.env terpusat
├── constants/      # life area, prioritas, model AI
├── features/       # server actions per domain: auth, tasks, assistant (AI), ...
├── hooks/          # use-audio-recorder, use-online
├── lib/supabase/   # client, server, auth, proxy (middleware)
├── migrations/     # SQL Supabase (RLS default-deny)
├── providers/      # react-query
├── stores/         # zustand (bottom sheet)
├── types/          # *.d.ts
└── validations/    # zod
```
