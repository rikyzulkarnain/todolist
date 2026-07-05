// Supabase Edge Function: send-reminders
// Dijalankan tiap menit (cron). Mengirim Web Push untuk task yang waktunya
// sudah tiba (reminder 'push'|'alarm', belum terkirim) ke semua langganan
// milik user, lalu menandai reminder_sent_at agar tidak dikirim dua kali.
//
// Deploy:  supabase functions deploy send-reminders --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
//                               VAPID_SUBJECT=mailto:kamu@contoh.com
// (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis tersedia di runtime.)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Zona waktu wall-clock task. due_time disimpan sebagai HH:mm lokal tanpa tz,
// jadi "sekarang" dihitung di zona ini (default Asia/Jakarta, WIB).
const APP_TZ = Deno.env.get("APP_TZ") ?? "Asia/Jakarta";

const AREA_ICON = "/icon.svg";

function nowParts(): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@ailifeos.app";

  if (!publicKey || !privateKey) {
    return new Response("VAPID keys missing", { status: 500 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { date, time } = nowParts();

  // Task yang jatuh tempo hari ini, waktunya sudah lewat/tepat, belum selesai,
  // punya pengingat, dan belum dikirimi push.
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, user_id, title, life_area, due_time, reminder")
    .eq("due_date", date)
    .lte("due_time", time)
    .neq("status", "done")
    .in("reminder", ["push", "alarm"])
    .is("reminder_sent_at", null);

  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const task of tasks ?? []) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", task.user_id);

    const payload = JSON.stringify({
      title:
        task.reminder === "alarm"
          ? `⏰ Alarm — ${task.title}`
          : `Pengingat: ${task.title}`,
      body: `${task.due_time} · ${task.life_area}`,
      tag: `task-${task.id}`,
      requireInteraction: task.reminder === "alarm",
      icon: AREA_ICON,
      data: { url: "/home" },
    });

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        sent++;
      } catch (err) {
        // 404/410 = langganan kedaluwarsa → hapus.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    await supabase
      .from("tasks")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", task.id);
  }

  return new Response(JSON.stringify({ processed: tasks?.length ?? 0, sent }), {
    headers: { "content-type": "application/json" },
  });
});
