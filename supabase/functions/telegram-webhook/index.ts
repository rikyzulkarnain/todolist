// Supabase Edge Function: telegram-webhook
// Menerima update dari Telegram. Fungsi:
//   /start <token>  → tautkan chat ke akun app (dari deep link di aplikasi)
//   /today | /hari  → daftar task hari ini
//   teks biasa      → buat task baru (judul = teks) untuk user tertaut
//
// Deploy:  supabase functions deploy telegram-webhook --no-verify-jwt
// Secret:  supabase secrets set TELEGRAM_BOT_TOKEN=... APP_TZ=Asia/Jakarta \
//                               TELEGRAM_WEBHOOK_SECRET=<opsional>
// Set webhook (sekali):
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=\
//     https://<REF>.functions.supabase.co/telegram-webhook\
//     &secret_token=<TELEGRAM_WEBHOOK_SECRET>"

import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const APP_TZ = Deno.env.get("APP_TZ") ?? "Asia/Jakarta";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

function todayInTz(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(
    new Date(),
  );
}

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

Deno.serve(async (req) => {
  // Verifikasi opsional: Telegram mengirim header secret bila di-set.
  if (
    WEBHOOK_SECRET &&
    req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET
  ) {
    return new Response("forbidden", { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let update: {
    message?: { chat: { id: number }; text?: string; from?: { username?: string } };
  };
  try {
    update = await req.json();
  } catch {
    return new Response("ok");
  }

  const msg = update.message;
  if (!msg?.text) return new Response("ok");

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // /start <token> → tautkan akun.
  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await sendMessage(
        chatId,
        "👋 Halo! Untuk menghubungkan, buka <b>AI Life OS → Profil → Telegram</b> dan tekan <b>Hubungkan</b>.",
      );
      return new Response("ok");
    }
    const { data: link } = await supabase
      .from("telegram_links")
      .select("user_id")
      .eq("link_token", token)
      .maybeSingle();
    if (!link) {
      await sendMessage(chatId, "❌ Kode tidak valid atau kadaluarsa.");
      return new Response("ok");
    }
    await supabase
      .from("telegram_links")
      .update({
        chat_id: chatId,
        username: msg.from?.username ?? null,
        linked: true,
      })
      .eq("user_id", link.user_id);
    await sendMessage(
      chatId,
      "✅ <b>Berhasil terhubung!</b>\nKirim teks apa pun untuk membuat task, atau ketik /today untuk melihat task hari ini.",
    );
    return new Response("ok");
  }

  // Selain /start: butuh akun tertaut.
  const { data: link } = await supabase
    .from("telegram_links")
    .select("user_id")
    .eq("chat_id", chatId)
    .eq("linked", true)
    .maybeSingle();
  if (!link) {
    await sendMessage(
      chatId,
      "Akun belum terhubung. Buka <b>AI Life OS → Profil → Telegram</b> lalu tekan Hubungkan.",
    );
    return new Response("ok");
  }
  const userId = link.user_id as string;

  // /today | /hari → daftar task hari ini.
  if (text === "/today" || text === "/hari") {
    const today = todayInTz();
    const { data: tasks } = await supabase
      .from("tasks")
      .select("title, due_time, status")
      .eq("user_id", userId)
      .eq("due_date", today)
      .order("due_time", { ascending: true, nullsFirst: false });

    if (!tasks || tasks.length === 0) {
      await sendMessage(chatId, "🎉 Tidak ada task hari ini.");
      return new Response("ok");
    }
    const lines = tasks
      .map((t: { title: string; due_time: string | null; status: string }) => {
        const box = t.status === "done" ? "✅" : "⬜";
        const time = t.due_time ? ` <b>${t.due_time}</b>` : "";
        return `${box}${time} ${t.title}`;
      })
      .join("\n");
    await sendMessage(chatId, `📋 <b>Task hari ini</b>\n${lines}`);
    return new Response("ok");
  }

  // Teks biasa → buat task baru untuk hari ini.
  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    title: text.slice(0, 200),
    life_area: "Pribadi",
    priority: "sedang",
    due_date: todayInTz(),
    source: "manual",
    reminder: "none",
  });
  if (error) {
    await sendMessage(chatId, "⚠️ Gagal menyimpan task. Coba lagi.");
    return new Response("ok");
  }
  await sendMessage(chatId, `✅ Dicatat: <b>${text}</b>`);
  return new Response("ok");
});
