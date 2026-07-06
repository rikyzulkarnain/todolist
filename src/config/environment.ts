export const ENVIRONMENT = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  googleGenAIKey: process.env.GOOGLE_GEN_AI_API_KEY,
  // Kunci publik VAPID untuk Web Push (opsional; hanya perlu saat mengaktifkan
  // notifikasi server-side lewat Edge Function send-reminders).
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  // Telegram bot (server-only) — untuk deep link & kirim pesan dari app.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  // Google Calendar OAuth (integrasi v3).
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // Base URL app untuk redirect OAuth (fallback localhost saat dev).
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};
