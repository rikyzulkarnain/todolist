# send-reminders — Web Push server-side

Edge Function yang mengirim notifikasi **Web Push** untuk task yang jatuh tempo,
sehingga reminder tetap sampai walau app/PWA tertutup. Melengkapi penjadwal
_foreground_ di klien (`ReminderScheduler`) yang hanya jalan saat app terbuka.

## 1. Buat kunci VAPID

```bash
npx web-push generate-vapid-keys
```

- **Public key** → taruh di `.env.local` sebagai `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  (dipakai klien untuk berlangganan).
- **Private key** → simpan sebagai secret Supabase (jangan pernah di klien).

## 2. Jalankan migrations

Pastikan `010-push-subscriptions.sql` sudah dijalankan (tabel
`push_subscriptions` + kolom `tasks.reminder_sent_at`).

## 3. Deploy function + set secrets

```bash
supabase functions deploy send-reminders --no-verify-jwt
supabase secrets set \
  VAPID_PUBLIC_KEY="<public>" \
  VAPID_PRIVATE_KEY="<private>" \
  VAPID_SUBJECT="mailto:kamu@contoh.com" \
  APP_TZ="Asia/Jakarta"
```

`SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` sudah otomatis tersedia di runtime.

## 4. Jadwalkan cron (tiap menit)

Aktifkan ekstensi `pg_cron` & `pg_net` di Dashboard → Database → Extensions,
lalu jalankan di SQL Editor (ganti `<PROJECT_REF>` dan `<SERVICE_ROLE_KEY>`):

```sql
select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url    := 'https://<PROJECT_REF>.functions.supabase.co/send-reminders',
    headers:= jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body   := '{}'::jsonb
  );
  $$
);
```

## Cara kerja

- Setiap menit, function mencari task `due_date = hari ini`,
  `due_time <= sekarang` (zona `APP_TZ`), belum `done`, `reminder in
  ('push','alarm')`, dan `reminder_sent_at IS NULL`.
- Untuk tiap task, mengirim push ke semua `push_subscriptions` milik user, lalu
  mengisi `reminder_sent_at` supaya tidak dobel. Langganan yang kedaluwarsa
  (404/410) dihapus otomatis.
- Klien menyimpan langganan lewat `subscribeToPush()` saat notifikasi diaktifkan
  (Profil) atau saat app dibuka dengan izin sudah granted.

## Catatan

- `due_time` disimpan sebagai wall-clock lokal tanpa timezone; `APP_TZ`
  menyamakan perhitungan "sekarang". Untuk multi-timezone, simpan timezone
  per user dan hitung per user.
