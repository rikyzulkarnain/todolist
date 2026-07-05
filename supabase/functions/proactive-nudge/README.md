# proactive-nudge — Proactive AI (PRD §6.5)

Edge Function yang mengirim **nudge proaktif** (Web Push) berdasarkan kondisi
nyata user — bukan spam. Contoh aturan (rule-based, PRD §6.4):

- **overload** — sore hari & ≥3 task hari ini belum selesai → dorong fokus 1 task.
- **deadline** — siang hari & ada task prioritas urgent/tinggi belum selesai.
- **reflection** — malam & belum ada refleksi hari ini → ajak refleksi.

## Guardrails

- **Frequency cap**: maksimal `MAX_NUDGES_PER_DAY` (default 3) per user per hari,
  dan kind yang sama tidak diulang di hari yang sama (tabel `ai_nudges`).
- **Jam tenang**: tidak mengirim pukul 22:00–07:00 (zona `APP_TZ`/timezone user).
- Hanya user yang punya langganan Web Push yang dievaluasi.

## Setup

1. Jalankan migration `013-proactive-nudges.sql` (tabel `ai_nudges`) dan
   `011-user-timezone.sql` (timezone user).
2. Butuh Web Push sudah aktif (lihat `../send-reminders/README.md` untuk VAPID
   & `push_subscriptions`). Secrets sama: `VAPID_*`, `APP_TZ`.
3. Deploy & jadwalkan cron tiap jam:

```bash
supabase functions deploy proactive-nudge --no-verify-jwt
```

```sql
select cron.schedule(
  'proactive-nudge-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url    := 'https://<PROJECT_REF>.functions.supabase.co/proactive-nudge',
    headers:= jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body   := '{}'::jsonb
  );
  $$
);
```

Kembangkan aturan di fungsi `evaluate()` (mis. istirahat setelah terlalu lama
tanpa jeda, olahraga, quality time) sesuai kebutuhan.
