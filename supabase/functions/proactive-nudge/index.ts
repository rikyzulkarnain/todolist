// Supabase Edge Function: proactive-nudge
// Dijalankan tiap jam (cron). Mengevaluasi kondisi tiap user (PRD §6.5) dan
// mengirim Web Push proaktif — dengan frequency cap (maks N/hari) dan jam
// tenang, agar tidak jadi spam.
//
// Deploy:  supabase functions deploy proactive-nudge --no-verify-jwt
// Secrets sama dengan send-reminders (VAPID_*, APP_TZ). Jadwalkan cron
// '0 * * * *' seperti di send-reminders/README.md.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const APP_TZ = Deno.env.get("APP_TZ") ?? "Asia/Jakarta";
const MAX_NUDGES_PER_DAY = 3;
const QUIET_START = 22; // 22:00
const QUIET_END = 7; // 07:00

type Nudge = { kind: string; message: string; ref_id?: string | null };

function tzParts(tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
  };
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@ailifeos.app";
  if (!publicKey || !privateKey)
    return new Response("VAPID keys missing", { status: 500 });
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createClient(supabaseUrl, serviceKey);

  // Hanya user yang punya langganan push (kandidat penerima).
  const { data: subsAll } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");
  const byUser = new Map<string, typeof subsAll>();
  for (const s of subsAll ?? []) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  let sent = 0;
  for (const [userId, subs] of byUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle();
    const tz = profile?.timezone ?? APP_TZ;
    const { date, hour } = tzParts(tz);

    // Jam tenang → lewati.
    if (hour >= QUIET_START || hour < QUIET_END) continue;

    // Frequency cap harian.
    const startUtc = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("ai_nudges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", `${startUtc}T00:00:00`);
    if ((count ?? 0) >= MAX_NUDGES_PER_DAY) continue;

    const nudge = await evaluate(supabase, userId, date, hour);
    if (!nudge) continue;

    // Hindari nudge kind yang sama berulang di hari sama.
    const { data: dup } = await supabase
      .from("ai_nudges")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", nudge.kind)
      .gte("created_at", `${startUtc}T00:00:00`)
      .limit(1);
    if (dup && dup.length) continue;

    const payload = JSON.stringify({
      title: "AI Life OS",
      body: nudge.message,
      tag: `nudge-${nudge.kind}`,
      icon: "/icon.svg",
      data: { url: "/home" },
    });

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410)
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
      }
    }

    await supabase.from("ai_nudges").insert({
      user_id: userId,
      kind: nudge.kind,
      message: nudge.message,
      ref_id: nudge.ref_id ?? null,
    });
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { "content-type": "application/json" },
  });
});

// Aturan rule-based (PRD §6.4/§6.5). Kembalikan satu nudge paling relevan.
async function evaluate(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  today: string,
  hour: number,
): Promise<Nudge | null> {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, due_time, status, priority")
    .eq("user_id", userId)
    .eq("due_date", today)
    .neq("status", "done");

  const openToday = tasks ?? [];

  // 1) Sore/petang & masih banyak task belum selesai → dorong fokus.
  if (hour >= 16 && hour < 20 && openToday.length >= 3) {
    return {
      kind: "overload",
      message: `Masih ada ${openToday.length} task hari ini. Pilih 1 yang paling penting dan kerjakan sekarang 💪`,
    };
  }

  // 2) Task urgent/tinggi hari ini belum selesai di siang hari.
  const important = openToday.find(
    (t: { priority: string }) =>
      t.priority === "urgent" || t.priority === "tinggi",
  );
  if (important && hour >= 9 && hour < 16) {
    return {
      kind: "deadline",
      message: `"${important.title}" prioritas tinggi dan masih terbuka. Selesaikan selagi fokusmu bagus.`,
      ref_id: important.id,
    };
  }

  // 3) Malam & belum ada refleksi hari ini → ajak refleksi.
  if (hour >= 20) {
    const { data: refl } = await supabase
      .from("reflections")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();
    if (!refl) {
      return {
        kind: "reflection",
        message: "Sebelum tidur, yuk catat 1 refleksi singkat tentang harimu 🌙",
      };
    }
  }

  return null;
}
