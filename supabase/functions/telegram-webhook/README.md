# telegram-webhook — Integrasi Telegram (v3)

Bot Telegram dua arah: buat task dari chat, lihat task hari ini, dan (lewat
`send-reminders`) terima pengingat di Telegram.

## Kemampuan bot

| Kirim ke bot | Hasil |
|---|---|
| deep link `t.me/<bot>?start=<token>` | Menautkan chat ke akun app |
| teks biasa | Membuat task baru (judul = teks) untuk hari ini |
| `/today` atau `/hari` | Menampilkan daftar task hari ini |

Reminder task (jenis Notifikasi/Alarm) juga dikirim ke Telegram bila akun
tertaut — lihat `../send-reminders`.

## Setup

1. Jalankan migration `015-telegram.sql` (tabel `telegram_links`).
2. Set secrets & deploy:

```bash
supabase secrets set \
  TELEGRAM_BOT_TOKEN="<token dari @BotFather>" \
  APP_TZ="Asia/Jakarta" \
  TELEGRAM_WEBHOOK_SECRET="<string acak, opsional>"

supabase functions deploy telegram-webhook --no-verify-jwt
```

3. Daftarkan webhook ke Telegram (sekali):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT_REF>.functions.supabase.co/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

4. Di app: **Profil → Telegram → Hubungkan** → membuka bot dengan deep link →
   tekan **Start**. Selesai.

## Catatan

- `TELEGRAM_BOT_TOKEN` juga perlu ada di `.env.local` app (untuk membuat deep
  link via getMe di server action). Jangan pernah taruh di klien.
- Untuk keamanan, set `TELEGRAM_WEBHOOK_SECRET` agar hanya request dari Telegram
  yang diproses (header `X-Telegram-Bot-Api-Secret-Token`).
