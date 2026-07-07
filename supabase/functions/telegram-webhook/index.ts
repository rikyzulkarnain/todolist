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

// ── AI agent (function calling) ────────────────────────────────────────────
// Memahami konteks: bisa membuat, menyelesaikan, ATAU menghapus task sesuai
// maksud pesan — bukan selalu membuat baru.

// deno-lint-ignore no-explicit-any
type Json = any;

const FUNCTIONS = [
  {
    name: "create_task",
    description: "Buat SATU task baru untuk pengguna.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Judul task, ringkas." },
        day_offset: {
          type: "NUMBER",
          description: "0=hari ini, 1=besok, 2=lusa, dst.",
        },
        time: { type: "STRING", description: "Jam 'HH:mm' bila disebut." },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_task",
    description: "Tandai task SELESAI. Pakai id dari daftar task.",
    parameters: {
      type: "OBJECT",
      properties: { id: { type: "STRING" } },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Hapus task. Pakai id dari daftar task.",
    parameters: {
      type: "OBJECT",
      properties: { id: { type: "STRING" } },
      required: ["id"],
    },
  },
];

function addDaysStr(today: string, offset: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function geminiGenerate(
  sys: string,
  contents: Json[],
): Promise<Json | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents,
            tools: [{ functionDeclarations: FUNCTIONS }],
            generationConfig: { temperature: 0.3 },
          }),
        },
      );
      if (!res.ok) {
        console.error(`Gemini ${model} HTTP ${res.status}: ${await res.text()}`);
        continue;
      }
      return await res.json();
    } catch (e) {
      console.error(`Gemini ${model} error`, e);
      continue;
    }
  }
  return null;
}

async function execFn(
  supabase: Json,
  userId: string,
  today: string,
  name: string,
  args: Json,
): Promise<Json> {
  if (name === "create_task") {
    const offset = Math.max(0, Math.round(Number(args.day_offset) || 0));
    const time = args.time ? String(args.time) : null;
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: String(args.title ?? "Task").slice(0, 200),
      life_area: "Pribadi",
      priority: "sedang",
      due_date: addDaysStr(today, offset),
      due_time: time,
      source: "manual",
      reminder: time ? "push" : "none",
    });
    return { success: !error };
  }
  if (name === "complete_task") {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", String(args.id))
      .eq("user_id", userId);
    return { success: !error };
  }
  if (name === "delete_task") {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", String(args.id))
      .eq("user_id", userId);
    return { success: !error };
  }
  return { success: false };
}

/** Jalankan agent: pahami maksud pesan atas konteks task pengguna. */
async function runAgent(
  supabase: Json,
  userId: string,
  text: string,
  today: string,
): Promise<string> {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, due_time, status")
    .eq("user_id", userId)
    .or(`due_date.is.null,due_date.gte.${addDaysStr(today, -3)}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(60);

  const taskLines =
    (tasks ?? [])
      .map(
        (t: Json) =>
          `- id=${t.id} | ${t.title} | ${t.due_date ?? "tanpa tanggal"}${t.due_time ? " " + t.due_time : ""} | ${t.status === "done" ? "SELESAI" : "belum"}`,
      )
      .join("\n") || "(belum ada task)";

  const dayName = new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TZ,
    weekday: "long",
  }).format(new Date());

  const sys = `Kamu asisten Telegram untuk aplikasi "AI Life OS" (Bahasa Indonesia). Hari & tanggal ini: ${dayName}, ${today} (zona ${APP_TZ}).

Daftar task pengguna saat ini:
${taskLines}

Aturan:
- Pahami MAKSUD pesan: membuat, menyelesaikan, atau menghapus task.
- Membuat: panggil create_task (day_offset 0=hari ini,1=besok; time "HH:mm" bila disebut).
- RENTANG tanggal ("dari Rabu sampai Jumat", "Senin–Kamis", "3 hari ke depan") bersifat INKLUSIF: panggil create_task untuk SETIAP hari termasuk hari terakhir. Contoh: hari ini Selasa, "Rabu sampai Jumat" → 3 task (day_offset 1,2,3). Hitung day_offset dari nama hari di atas.
- Menyelesaikan/menghapus: cari id paling cocok dari daftar lalu panggil complete_task / delete_task. JANGAN membuat task baru saat pengguna minta hapus/selesai.
- Bisa memanggil beberapa fungsi sekaligus bila pengguna menyebut banyak hal.
- Jika tidak ada task yang cocok untuk dihapus/diselesaikan, katakan dengan sopan (jangan buat baru).
- Balas SINGKAT, hangat, Bahasa Indonesia (boleh 1 emoji). Jangan pernah menyebut id ke pengguna.`;

  const contents: Json[] = [{ role: "user", parts: [{ text }] }];
  const acts = { created: 0, completed: 0, deleted: 0, failed: 0 };
  let reply = "";
  let apiFailed = false;

  for (let turn = 0; turn < 5; turn++) {
    const resp = await geminiGenerate(sys, contents);
    if (!resp) {
      apiFailed = true;
      break;
    }
    const parts: Json[] = resp.candidates?.[0]?.content?.parts ?? [];
    if (parts.length === 0) break;

    const calls = parts.filter((p: Json) => p.functionCall);
    for (const p of parts) if (p.text) reply += p.text;
    if (calls.length === 0) break;

    contents.push({ role: "model", parts });
    const responseParts: Json[] = [];
    for (const c of calls) {
      const name = c.functionCall.name;
      const result = await execFn(
        supabase,
        userId,
        today,
        name,
        c.functionCall.args ?? {},
      );
      if (!result.success) acts.failed++;
      else if (name === "create_task") acts.created++;
      else if (name === "complete_task") acts.completed++;
      else if (name === "delete_task") acts.deleted++;
      responseParts.push({
        functionResponse: { name, response: { result } },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  // Balasan jujur: kalau AI gagal total, katakan; kalau ada aksi, ringkas.
  const total = acts.created + acts.completed + acts.deleted;
  if (apiFailed && total === 0)
    return "⚠️ Maaf, asistennya sedang bermasalah. Coba lagi sebentar ya. (Jika terus terjadi, cek secret GEMINI_API_KEY di Supabase.)";
  if (reply.trim()) return reply.trim();
  if (total > 0) {
    const bits: string[] = [];
    if (acts.created) bits.push(`➕ ${acts.created} dibuat`);
    if (acts.completed) bits.push(`✅ ${acts.completed} selesai`);
    if (acts.deleted) bits.push(`🗑️ ${acts.deleted} dihapus`);
    return bits.join(" · ");
  }
  return "Hmm, aku belum menangkap maksudmu. Coba tulis lebih jelas ya 🙂";
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
        "🤖 <b>Aku mengerti maksudmu — tinggal ngobrol biasa:</b>",
        "",
        "➕ <b>Buat</b>: <i>Rapat tim besok jam 2 siang</i>",
        "✅ <b>Selesai</b>: <i>udah selesai olahraga</i> / <i>tandai bayar listrik selesai</i>",
        "🗑️ <b>Hapus</b>: <i>hapus task belajar mobil</i>",
        "📋 /today — lihat task hari ini",
        "",
        "Tanggal & jam otomatis dikenali. Semua tersambung dengan aplikasi & pengingatmu.",
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

  const today = todayInTz();

  // Dengan AI: agent memahami konteks (buat / selesai / hapus task).
  if (GEMINI_KEY) {
    const reply = await runAgent(supabase, userId, text, today);
    await sendMessage(chatId, reply);
    return new Response("ok");
  }

  // Tanpa AI: fallback sederhana — teks jadi judul task hari ini.
  const parsed = await parseTask(text, today);
  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    title: parsed.title,
    life_area: "Pribadi",
    priority: "sedang",
    due_date: parsed.due_date,
    due_time: parsed.due_time,
    source: "manual",
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
