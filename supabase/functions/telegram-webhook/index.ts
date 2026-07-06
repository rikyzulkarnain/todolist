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
// API key Gemini untuk memahami tanggal & jam dari kalimat bebas.
const GEMINI_KEY =
  Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_GEN_AI_API_KEY");
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
];

function todayInTz(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(
    new Date(),
  );
}

type ParsedTask = { title: string; due_date: string; due_time: string | null };

/**
 * Pahami pesan bebas → {judul, tanggal, jam} lewat Gemini. Contoh yang dikenali:
 * "rapat besok jam 2 siang", "olahraga senin 06:30", "bayar listrik tgl 25".
 * Fallback: judul = teks, tanggal = hari ini, tanpa jam.
 */
async function parseTask(text: string, today: string): Promise<ParsedTask> {
  const fallback: ParsedTask = {
    title: text.slice(0, 200),
    due_date: today,
    due_time: null,
  };
  if (!GEMINI_KEY) return fallback;

  const prompt = `Ekstrak pesan pengguna menjadi SATU task. Balas HANYA JSON valid: {"title": string, "due_date": "yyyy-MM-dd", "due_time": "HH:mm" atau null}.
Aturan:
- Hari ini ${today} (zona ${APP_TZ}). Pahami "hari ini", "besok" (+1 hari), "lusa" (+2), nama hari (senin..minggu → kejadian terdekat ke depan), dan tanggal eksplisit ("tanggal 25", "25/12").
- Jika tidak ada tanggal, pakai hari ini.
- due_time 24 jam "HH:mm". "jam 2 siang"=14:00, "jam 8 pagi"=08:00, "setengah 8 malam"=19:30. Jika tidak ada waktu, null.
- title ringkas dalam Bahasa Indonesia, TANPA keterangan waktu/tanggal.
Pesan: "${text.replace(/"/g, "'")}"`;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (!res.ok) continue;
      const json = await res.json();
      const out = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!out) continue;
      const p = JSON.parse(out);
      const title = String(p.title ?? text).trim().slice(0, 200) || fallback.title;
      const due_date = /^\d{4}-\d{2}-\d{2}$/.test(p.due_date)
        ? p.due_date
        : today;
      const due_time = /^\d{2}:\d{2}$/.test(p.due_time) ? p.due_time : null;
      return { title, due_date, due_time };
    } catch {
      continue;
    }
  }
  return fallback;
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

  // /help → daftar kemampuan bot.
  if (text === "/help" || text === "/bantuan") {
    await sendMessage(
      chatId,
      [
        "🤖 <b>Yang bisa kamu lakukan:</b>",
        "",
        "• Kirim kalimat biasa untuk membuat task — <b>tanggal & jam otomatis dikenali</b>.",
        "   contoh: <i>Rapat tim besok jam 2 siang</i>",
        "   contoh: <i>Olahraga senin 06:30</i>",
        "   contoh: <i>Bayar listrik tanggal 25</i>",
        "• /today — lihat task hari ini",
        "• /help — bantuan ini",
        "",
        "Task yang kamu buat langsung muncul di aplikasi & kamu diingatkan tepat waktu.",
      ].join("\n"),
    );
    return new Response("ok");
  }

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

  // Teks biasa → pahami tanggal/jam via AI, lalu buat task.
  const today = todayInTz();
  const parsed = await parseTask(text, today);
  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    title: parsed.title,
    life_area: "Pribadi",
    priority: "sedang",
    due_date: parsed.due_date,
    due_time: parsed.due_time,
    source: "manual",
    // Ada jam → ingatkan; task juga muncul di app & Google Calendar (bila aktif).
    reminder: parsed.due_time ? "push" : "none",
  });
  if (error) {
    await sendMessage(chatId, "⚠️ Gagal menyimpan task. Coba lagi.");
    return new Response("ok");
  }
  const when = parsed.due_date === today ? "hari ini" : parsed.due_date;
  await sendMessage(
    chatId,
    `✅ Dicatat: <b>${parsed.title}</b>\n🗓️ ${when}${parsed.due_time ? " · " + parsed.due_time : ""}`,
  );
  return new Response("ok");
});
