# telegram-webhook — Integrasi Telegram (v3)

Bot Telegram dua arah: buat task dari chat, lihat task hari ini, dan (lewat
`send-reminders`) terima pengingat di Telegram.

## Kemampuan bot

| Kirim ke bot | Hasil |
|---|---|
| deep link `t.me/<bot>?start=<token>` | Menautkan chat ke akun app |
| teks biasa | **AI agent** memahami maksud atas konteks task-mu: buat, selesaikan, atau hapus (mis. "Rapat besok jam 2 siang", "udah selesai olahraga", "hapus task belajar mobil") |
| `/today` atau `/hari` | Menampilkan daftar task hari ini |
| `/help` | Bantuan / daftar kemampuan |

> Agent memakai Gemini **function calling** dengan daftar task-mu sebagai
> konteks, jadi "hapus/selesaikan X" tidak membuat task baru. Set secret
> `GEMINI_API_KEY` (atau `GOOGLE_GEN_AI_API_KEY`). Tanpa key itu, bot turun ke
> mode sederhana (teks → judul task hari ini).

Reminder task (jenis Notifikasi/Alarm) juga dikirim ke Telegram bila akun
tertaut — lihat `../send-reminders`.

## Setup

1. Jalankan migration `015-telegram.sql` (tabel `telegram_links`).
2. Set secrets & deploy:

```bash
supabase secrets set \
  TELEGRAM_BOT_TOKEN="<token dari @BotFather>" \
  APP_TZ="Asia/Jakarta" \
  GEMINI_API_KEY="<GOOGLE_GEN_AI_API_KEY-mu>" \
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
