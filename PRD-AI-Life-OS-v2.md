# PRD — AI Life OS (v2.0, Build-Ready)

> **Cara pakai dokumen ini.** PRD ini adalah revisi dari draft awal, dibuat agar bisa langsung dipakai di **Claude Design** (untuk merancang UI tiap layar) lalu dieksekusi di **Claude Code** (untuk implementasi). Bagian yang paling menentukan urutan kerja ada di **§3 Scope & Phasing** dan **§18 Build Order**. Mulailah dari sana.

---

## 0. Ringkasan Perubahan dari Draft Awal

Draft awal kuat sebagai visi, tetapi masih berupa daftar fitur. Versi ini menambahkan hal-hal yang wajib ada sebelum implementasi: pembagian fase (MVP vs nanti), tech stack, data model, spesifikasi AI yang konkret, keamanan/privasi, model izin untuk mode berbagi, dan spesifikasi tiap layar beserta empty/error/loading state.

---

## 1. Vision & North Star

**Visi.** AI Life OS adalah *personal operating system* yang membantu pengguna mengatur hidup, bukan sekadar mencatat to-do. Pengguna selalu tahu apa yang harus dikerjakan sekarang; AI memahami tujuan, kebiasaan, dan histori pengguna, lalu memberi arahan proaktif.

**North Star Metric.** "Pengguna membuka aplikasi dan langsung tahu apa yang harus dilakukan berikutnya, tanpa merasa bingung." Secara terukur: **% sesi di mana pengguna menyelesaikan minimal 1 aksi yang direkomendasikan AI dalam 60 detik pertama.**

**Target user.** Individu (fokus utama v1) → Pasangan (v2) → Keluarga (v3).

---

## 2. Keputusan Produk & Asumsi

Ini keputusan yang saya ambil agar dokumen bisa dieksekusi. **Ubah bila tidak sesuai** — semua bagian teknis di bawah mengikuti keputusan ini.

| # | Keputusan | Alasan | Ubah jika... |
|---|-----------|--------|--------------|
| A1 | **Satu codebase lintas platform: React Native + Expo** (Android, iOS, dan web/PWA dari satu sumber) | Draft minta "PWA/Android/iOS" — tiga jalur; Expo menyatukannya dan cocok untuk Claude Code | Anda ingin Flutter, atau web-only dulu |
| A2 | **Backend: Supabase** (Postgres, Auth, Realtime, Storage, Row-Level Security, Edge Functions) | Menangani Email+Google login, data model, sinkronisasi realtime untuk mode berbagi, dan izin per-baris — mengurangi kode backend drastis | Anda sudah punya backend / ingin Firebase |
| A3 | **AI: Claude API (Anthropic)** untuk chat, penyusunan agenda, OCR (Claude vision), dan reasoning | Satu penyedia untuk semua kebutuhan AI; Claude bisa membaca gambar langsung sehingga OCR tidak perlu engine terpisah | — |
| A4 | **Memory jangka panjang: pgvector di Supabase** (RAG) | Menyimpan & memanggil kembali konteks pengguna tanpa infrastruktur vector DB terpisah | — |
| A5 | **Bahasa v1: Indonesia saja**, arsitektur disiapkan multi-bahasa (i18n) | Fokus pasar; hindari over-engineering | — |
| A6 | **Model bisnis: Freemium.** Gratis untuk fitur dasar; langganan untuk AI tanpa batas & mode berbagi | Panggilan AI berbiaya per token, harus berkelanjutan | — |

---

## 3. Scope & Phasing (BAGIAN PALING PENTING)

Jangan bangun semuanya sekaligus. Urutan ini disusun agar setiap fase menghasilkan aplikasi yang bisa dipakai.

### MVP (v1.0) — "Tahu apa yang harus dikerjakan hari ini"
Tujuan: membuktikan North Star untuk **individu**.
- Auth (Email + Google)
- Onboarding singkat (kumpulkan 1–3 goal & jam produktif)
- Task management: task, subtask, priority, due date, repeat, tags, life area
- Calendar: daily & weekly
- Reminder: notifikasi push + snooze + reschedule
- Dashboard: greeting, fokus hari ini, progress
- **AI Chat dasar**: "Saya bingung hari ini" → AI menyusun agenda prioritas dari task yang ada
- Bottom navigation 5 tab

### v1.1 — "AI mulai proaktif"
- Voice → task (speech-to-text)
- OCR foto → task (via Claude vision)
- Daily reflection (mood + catatan)
- Weekly review (statistik + insight)
- Calendar monthly view
- Full-screen reminder + alarm acknowledge (lihat catatan kelayakan di §11)

### v2.0 — "Berbagi & belajar"
- Couple Mode (shared task/goal/calendar, shopping list)
- Habit learning (deteksi jam produktif/tidur → optimasi jadwal)
- Long-term memory (RAG) & recommendation engine
- Goal Tree (goal besar → milestone)
- Proactive AI (istirahat, olahraga, quality time, deadline)

### v3.0 — "Keluarga & integrasi"
- Family Mode (anak, jadwal keluarga, imunisasi, medical reminder)
- Integrasi Google Calendar, Telegram, Email

> **Aturan main:** fitur di fase berikut tidak dikerjakan sebelum fase sebelumnya stabil.

---

## 4. Tech Stack & Arsitektur

```
┌─────────────────────────────────────────────┐
│  CLIENT — React Native + Expo                │
│  (Android / iOS / Web-PWA, satu codebase)    │
│  - Expo Router (navigasi)                    │
│  - Zustand/React Query (state & cache)       │
│  - Expo Notifications (push)                  │
│  - Offline cache (SQLite/AsyncStorage)       │
└───────────────┬─────────────────────────────┘
                │ HTTPS
┌───────────────▼─────────────────────────────┐
│  SUPABASE                                    │
│  - Auth (email + Google OAuth)               │
│  - Postgres + Row-Level Security             │
│  - pgvector (long-term memory / RAG)         │
│  - Realtime (sinkronisasi shared data)       │
│  - Storage (foto OCR, avatar)                │
│  - Edge Functions (proxy ke AI, jadwal cron) │
└───────────────┬─────────────────────────────┘
                │ (kunci API disembunyikan di server)
┌───────────────▼─────────────────────────────┐
│  Claude API — chat, agenda, OCR, reasoning   │
│  Speech-to-Text — (Whisper/Google, dukung ID)│
└──────────────────────────────────────────────┘
```

**Prinsip penting:** panggilan ke Claude API **selalu lewat Edge Function**, tidak pernah dari client, agar API key aman dan penggunaan bisa dibatasi (rate limit + kuota per user).

---

## 5. Data Model (Skema Awal)

Tabel inti untuk MVP–v2. Semua tabel punya `id (uuid)`, `created_at`, `updated_at`.

**users** (dikelola Supabase Auth, ditambah profil)
`display_name`, `avatar_url`, `timezone`, `locale`, `plan (free|pro)`, `productive_hours (jsonb)`

**goals**
`user_id (fk)`, `title`, `description`, `life_area (enum)`, `status (active|done|archived)`, `target_date`, `parent_goal_id (fk, nullable)` ← untuk Goal Tree

**tasks**
`user_id`, `goal_id (fk, nullable)`, `parent_task_id (fk, nullable)` ← untuk subtask, `title`, `notes`, `life_area`, `priority (low|med|high|urgent)`, `due_at`, `repeat_rule (RRULE string)`, `status (todo|doing|done)`, `completed_at`, `source (manual|voice|ocr|ai)`

**tags** & **task_tags** (many-to-many)

**reminders**
`task_id (fk)`, `remind_at`, `type (push|fullscreen|alarm)`, `status (pending|snoozed|acknowledged|dismissed)`, `snooze_until`

**reflections**
`user_id`, `date`, `mood (1–5)`, `note`

**ai_memory** (RAG, v2)
`user_id`, `content (text)`, `embedding (vector)`, `kind (habit|preference|event|insight)`, `source_ref`

**shared_spaces** (Couple/Family, v2–v3)
`type (couple|family)`, `name`

**space_members**
`space_id (fk)`, `user_id (fk)`, `role (owner|member|child)`, `permissions (jsonb)`

> Untuk data berbagi, tabel `tasks`/`goals` diberi kolom `space_id (nullable)`. Row-Level Security memastikan pengguna hanya melihat baris miliknya atau space yang ia ikuti.

---

## 6. Spesifikasi AI (Konkret)

Bagian ini yang di draft awal masih abstrak. Berikut cara kerjanya secara teknis.

**6.1 Konteks yang dikirim ke AI.** Setiap panggilan menyertakan *context bundle* yang dirakit Edge Function: profil (jam produktif, timezone), goal aktif, task hari ini + minggu ini, dan (mulai v2) memori relevan hasil pencarian pgvector. Batasi ukuran konteks agar biaya token terkendali.

**6.2 Fitur "Saya bingung hari ini" (MVP).** Input: kalimat pengguna + context bundle. Output: agenda prioritas terstruktur (JSON) berisi daftar task terurut + alasan singkat, yang di-render sebagai kartu di UI — bukan sekadar teks. Minta AI membalas **hanya JSON** agar mudah di-parse.

**6.3 Long-term memory (v2).** Setelah reflection harian / event penting, ringkasan disimpan sebagai embedding di `ai_memory`. Saat AI dipanggil, ambil top-k memori termirip lewat pencarian vektor (RAG).

**6.4 Habit learning (v2).** Mulai dari **rule-based** atas data nyata (jam penyelesaian task, pola tidur dari waktu aktif), bukan ML dulu. Contoh aturan: "task berat dijadwalkan pada jam dengan completion rate tertinggi." Naikkan ke model statistik hanya bila terbukti perlu.

**6.5 Proactive AI (v2).** Dipicu oleh **cron Edge Function** (mis. tiap jam), mengevaluasi kondisi (deadline dekat, terlalu lama tanpa istirahat, dsb.). **Wajib ada frequency cap** (mis. maksimal 3 nudge proaktif/hari) agar tidak jadi spam.

**6.6 Biaya & batas.** Setiap panggilan AI dicatat (token in/out). Free plan: kuota harian; Pro: batas lebih tinggi. Tampilkan indikator saat kuota habis.

---

## 7. Privacy, Security & Compliance

Aplikasi menyimpan data sangat sensitif (mood, kesehatan, keuangan, ibadah, data anak, imunisasi). Ini **bukan opsional**.

- Enkripsi in-transit (HTTPS) dan at-rest (default Supabase).
- Row-Level Security untuk **setiap** tabel; default deny.
- Data anak (Family Mode) hanya dapat dibuat/diakses lewat akun orang tua (role `owner`). Terapkan pertimbangan perlindungan anak sesuai regulasi setempat.
- Kebijakan retensi & hak hapus akun (data benar-benar terhapus).
- Persetujuan eksplisit sebelum data dikirim ke AI; jelaskan data apa yang diproses.
- Rahasia (API key) hanya di server, tidak pernah di client.
- Consent screen + Privacy Policy sebelum rilis store.

---

## 8. Auth & Onboarding

**Auth.** Email (magic link atau password) + Google OAuth via Supabase.

**Onboarding (MVP, singkat — maksimal 4 langkah, bisa di-skip):**
1. Selamat datang + izin notifikasi.
2. "Apa 1–3 hal besar yang ingin kamu capai?" → membuat `goals` awal.
3. "Kapan kamu biasanya paling fokus?" (pagi/siang/malam) → mengisi `productive_hours`.
4. Buat task pertama (atau contoh otomatis).

Onboarding penting karena AI tak berguna tanpa data awal.

---

## 9. Spesifikasi Fitur MVP (per layar)

### 9.1 Dashboard (Home)
Isi: greeting personal (nama + waktu), **kartu "Fokus Hari Ini"** (1–3 task teratas hasil prioritas), progress bar harian (selesai/total), jadwal ringkas hari ini, tombol cepat "Tanya AI".
- *Empty state:* belum ada task → ajakan buat task / tanya AI.
- *Loading:* skeleton kartu.

### 9.2 Tasks
List berkelompok per Life Area / prioritas / due date (toggle). Aksi: tambah, edit, complete (swipe), subtask, tag, repeat (RRULE), pindah Life Area.
- *Empty state:* ilustrasi + CTA.
- *Error:* gagal simpan → retり + simpan offline.

### 9.3 Calendar
Daily & weekly (MVP), monthly (v1.1). Task dengan `due_at` muncul sebagai event. Tap tanggal → task hari itu.

### 9.4 Reminder
Push notification pada `remind_at`. Aksi dari notifikasi: Selesai / Snooze (5/15/30 mnt) / Reschedule. Full-screen + alarm acknowledge di v1.1 (lihat §11).

### 9.5 AI (tab)
Antarmuka chat. Perintah unggulan: "Saya bingung hari ini" → agenda prioritas (kartu). Indikator "AI sedang berpikir…". Karena respons AI bisa >2 detik, **selalu** tampilkan loading state.

---

## 10. Couple & Family Mode — Model Izin (v2–v3)

- **Flow undangan:** owner membuat space → kirim link/kode → anggota bergabung.
- **Peran:** `owner` (kelola anggota & izin), `member` (lihat+edit sesuai izin), `child` (v3, terbatas, dikontrol orang tua).
- **Izin granular** disimpan di `space_members.permissions`, mis. `can_edit_shared_tasks`, `can_view_calendar`.
- **Conflict resolution:** untuk edit offline bersamaan, gunakan strategi *last-write-wins* dengan `updated_at`, plus penanda konflik bila perlu. Realtime Supabase menyinkronkan perubahan.
- **Shopping list:** tabel sederhana `shopping_items(space_id, name, checked, added_by)`.

---

## 11. Voice, OCR & Reminder — Catatan Kelayakan Teknis

**Voice → task (v1.1).** Rekam suara → speech-to-text (pilih engine yang mendukung Bahasa Indonesia; Whisper atau Google Speech) → teks → Claude mengekstrak menjadi task terstruktur.

**OCR → task (v1.1).** Foto whiteboard/tagihan/screenshot/catatan → kirim gambar langsung ke **Claude vision** dengan instruksi "ekstrak menjadi daftar task". Tidak perlu engine OCR terpisah.

**Reminder "alarm hanya berhenti lewat aplikasi" (v1.1) — PERHATIAN:**
Ini sulit secara teknis. iOS **sangat membatasi** notifikasi background dan full-screen; perilaku "alarm terus berbunyi sampai di-acknowledge di app" tidak dijamin OS. Rekomendasi:
- Android: gunakan full-screen intent + foreground service (lebih memungkinkan).
- iOS: gunakan *critical alerts* (perlu izin khusus Apple) atau turunkan ekspektasi ke notifikasi berulang.
- **Sediakan fallback** yang jelas dan definisikan perilaku minimum yang dijamin lintas platform sebelum menjanjikannya ke pengguna.

---

## 12. Notifikasi

- **Expo Notifications** (FCM di Android, APNs di iOS) untuk push.
- Jenis: reminder task, nudge proaktif (v2), ringkasan harian/mingguan.
- Hormati frequency cap & jam tenang (jangan kirim saat jam tidur pengguna).

---

## 13. UX & Design System (untuk Claude Design)

**Prinsip.** Mobile first, bottom navigation, minimalis, cepat, dapat dioperasikan satu ibu jari.

**Navigasi (bottom, 5 tab):** Home · Calendar · **AI** (tombol tengah menonjol) · Tasks · Profile.

**Design system awal (silakan disesuaikan di Claude Design):**
- **Warna:** 1 warna primer (mis. indigo/teal menenangkan), netral abu untuk latar, warna aksen per Life Area (7 area = 7 warna label).
- **Tipografi:** 1 typeface, skala jelas (judul/isi/caption). Kontras tinggi.
- **Komponen inti:** kartu task, chip Life Area, bottom nav, FAB tambah task, kartu agenda AI, bottom sheet, full-screen reminder.
- **Density:** target sentuh ≥44px, konten utama dalam jangkauan ibu jari.

**Wajib dirancang untuk SETIAP layar:** *empty state*, *loading (skeleton)*, *error/offline state*. Ini yang paling sering terlewat dan paling dibutuhkan Claude Design.

**Aksesibilitas:** dukungan dynamic type, kontras cukup, label untuk screen reader.

---

## 14. Non-Functional Requirements (diperjelas)

Draft awal menulis "Fast (<2 detik)" yang bertabrakan dengan AI. Perjelas jadi:

- **Aksi lokal (buka app, buka/tandai task, buka layar): < 1 detik.**
- **Respons AI: boleh > 2 detik, wajib disertai indikator loading** dan idealnya *streaming* jawaban.
- **Offline:** task & calendar dapat dibaca dan diedit offline (cache lokal), lalu sinkron saat online. Fitur AI butuh koneksi — beri pesan jelas saat offline.
- Push notification andal.
- Skala data model mendukung mode berbagi tanpa refactor besar.

---

## 15. Analytics & Success Metrics

Pasang analytics sejak MVP (mis. PostHog/Amplitude). Metrik + **target awal** (baseline, revisi setelah data nyata):

| Metrik | Definisi | Target awal |
|--------|----------|-------------|
| DAU | Pengguna aktif harian | tumbuh W/W |
| Task completion rate | task selesai / dibuat | > 55% |
| Reminder response rate | reminder ditindaklanjuti | > 60% |
| Weekly retention | kembali dalam 7 hari | > 35% (W1) |
| AI recommendation acceptance | rekomendasi diterima/diikuti | > 40% |
| **North Star** | sesi dengan ≥1 aksi rekomendasi dalam 60 dtk | naik tiap fase |

---

## 16. Monetisasi (Freemium)

- **Free:** task/calendar penuh, reminder, AI chat dengan **kuota harian**.
- **Pro (langganan):** AI tanpa batas, long-term memory, habit learning, mode berbagi (Couple/Family), OCR/voice tanpa batas.
- Alasan: setiap panggilan AI berbiaya per token; langganan menjaga keberlanjutan.

---

## 17. Open Questions (butuh keputusan Anda)

1. Setuju dengan stack (Expo + Supabase + Claude API)? Atau ada preferензи lain?
2. MVP: cukup fitur di §3, atau ada yang ingin ditarik maju/mundur?
3. Target rilis pertama: store (Android/iOS) atau PWA dulu?
4. Bahasa: Indonesia saja untuk v1? (arsitektur tetap i18n-ready)
5. Harga Pro & besaran kuota Free — perlu ditentukan sebelum monetisasi.

---

## 18. Build Order untuk Claude Code

Urutan implementasi yang disarankan (tiap langkah menghasilkan sesuatu yang bisa dijalankan):

1. **Setup proyek** — Expo app + Expo Router + Supabase client + struktur folder.
2. **Auth** — Email + Google, layar login/register, profil.
3. **Data model** — buat tabel Supabase (§5) + Row-Level Security.
4. **Tasks CRUD** — list, tambah, edit, subtask, tags, priority, Life Area, offline cache.
5. **Calendar** — daily & weekly dari `tasks.due_at`.
6. **Reminders** — Expo Notifications + snooze/reschedule.
7. **Dashboard** — greeting, fokus hari ini, progress.
8. **AI Edge Function** — proxy aman ke Claude + kuota; fitur "Saya bingung hari ini" (output JSON → kartu).
9. **Onboarding** — 4 langkah, isi goal & jam produktif.
10. **Polish MVP** — empty/loading/error state, analytics, uji <1 dtk untuk aksi lokal.

Setelah MVP stabil → lanjut v1.1 (voice, OCR, reflection, weekly review), lalu v2, v3 sesuai §3.

---

*Dokumen ini siap dipakai: bawa §13 ke Claude Design untuk merancang layar, dan §5 + §9 + §18 ke Claude Code untuk implementasi.*
