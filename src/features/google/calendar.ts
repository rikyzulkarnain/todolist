import { ENVIRONMENT } from "@/config/environment";
import { createServiceClient } from "@/lib/supabase/service";
import { DEFAULT_TZ } from "@/lib/time";
import { addDays, format, parseISO } from "date-fns";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function googleRedirectUri(): string {
  return `${ENVIRONMENT.appUrl}/api/google/callback`;
}

type Link = {
  access_token: string | null;
  refresh_token: string;
  expiry: string | null;
  calendar_id: string;
};

/** Access token valid untuk user; refresh otomatis bila kedaluwarsa. Null bila
 *  belum terhubung. */
async function getValidAccessToken(
  userId: string,
): Promise<{ token: string; calendarId: string } | null> {
  const supabase = createServiceClient();
  const { data: link } = await supabase
    .from("google_calendar_links")
    .select("access_token, refresh_token, expiry, calendar_id")
    .eq("user_id", userId)
    .maybeSingle<Link>();
  if (!link) return null;

  const stillValid =
    link.access_token &&
    link.expiry &&
    new Date(link.expiry).getTime() - 60_000 > Date.now();
  if (stillValid)
    return { token: link.access_token!, calendarId: link.calendar_id };

  // Refresh.
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENVIRONMENT.googleClientId!,
      client_secret: ENVIRONMENT.googleClientSecret!,
      refresh_token: link.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  const expiry = new Date(Date.now() + json.expires_in * 1000).toISOString();
  await supabase
    .from("google_calendar_links")
    .update({ access_token: json.access_token, expiry })
    .eq("user_id", userId);
  return { token: json.access_token, calendarId: link.calendar_id };
}

type TaskForSync = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  gcal_event_id: string | null;
};

function eventBody(task: TaskForSync, tz: string) {
  const base = {
    summary: task.title,
    description: task.notes ?? "Dibuat dari AI Life OS",
  };
  if (task.due_time) {
    const start = `${task.due_date}T${task.due_time}:00`;
    const [h, m] = task.due_time.split(":").map(Number);
    const end = `${task.due_date}T${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    return {
      ...base,
      start: { dateTime: start, timeZone: tz },
      end: { dateTime: end, timeZone: tz },
    };
  }
  // Event sepanjang hari (end eksklusif = hari berikutnya).
  const endDate = format(addDays(parseISO(task.due_date!), 1), "yyyy-MM-dd");
  return {
    ...base,
    start: { date: task.due_date },
    end: { date: endDate },
  };
}

/**
 * Sinkronkan satu task ke Google Calendar (buat/perbarui event). No-op bila
 * user belum terhubung atau task tak bertanggal. Dipanggil di latar belakang.
 */
export async function syncTaskToGoogleCalendar(taskId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, user_id, title, notes, due_date, due_time, gcal_event_id")
    .eq("id", taskId)
    .maybeSingle<TaskForSync>();
  if (!task || !task.due_date) return;

  const auth = await getValidAccessToken(task.user_id);
  if (!auth) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", task.user_id)
    .maybeSingle<{ timezone: string | null }>();
  const tz = profile?.timezone ?? DEFAULT_TZ;

  const body = eventBody(task, tz);
  const cal = encodeURIComponent(auth.calendarId);

  if (task.gcal_event_id) {
    await fetch(`${CAL_BASE}/${cal}/events/${task.gcal_event_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return;
  }

  const res = await fetch(`${CAL_BASE}/${cal}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return;
  const created = (await res.json()) as { id?: string };
  if (created.id)
    await supabase
      .from("tasks")
      .update({ gcal_event_id: created.id })
      .eq("id", task.id);
}

/** Hapus event Google Calendar milik sebuah task (dipanggil sebelum/ saat hapus). */
export async function removeTaskFromGoogleCalendar(
  userId: string,
  eventId: string,
): Promise<void> {
  const auth = await getValidAccessToken(userId);
  if (!auth) return;
  const cal = encodeURIComponent(auth.calendarId);
  await fetch(`${CAL_BASE}/${cal}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${auth.token}` },
  });
}

type GCalEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
};

/**
 * Arah sebaliknya (Google Calendar → app): ambil event ~1 bulan ke depan lalu
 * buat/perbarui task dengan pemetaan gcal_event_id (tanpa duplikat). Event yang
 * berasal dari app juga cocok lewat gcal_event_id sehingga tidak dobel.
 */
export async function pullGoogleCalendarEvents(
  userId: string,
): Promise<{ imported: number; updated: number }> {
  const auth = await getValidAccessToken(userId);
  if (!auth) return { imported: 0, updated: 0 };
  const supabase = createServiceClient();

  const now = Date.now();
  const params = new URLSearchParams({
    timeMin: new Date(now - 86_400_000).toISOString(),
    timeMax: new Date(now + 30 * 86_400_000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const cal = encodeURIComponent(auth.calendarId);
  const res = await fetch(`${CAL_BASE}/${cal}/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!res.ok) return { imported: 0, updated: 0 };
  const data = (await res.json()) as { items?: GCalEvent[] };

  let imported = 0;
  let updated = 0;
  for (const ev of data.items ?? []) {
    if (!ev.id || ev.status === "cancelled") continue;
    const summary = (ev.summary ?? "").trim();
    if (!summary) continue;

    let due_date: string | null = null;
    let due_time: string | null = null;
    if (ev.start?.date) due_date = ev.start.date;
    else if (ev.start?.dateTime) {
      due_date = ev.start.dateTime.slice(0, 10);
      due_time = ev.start.dateTime.slice(11, 16);
    }
    if (!due_date) continue;

    const { data: existing } = await supabase
      .from("tasks")
      .select("id, title, due_date, due_time")
      .eq("user_id", userId)
      .eq("gcal_event_id", ev.id)
      .maybeSingle<{
        id: string;
        title: string;
        due_date: string | null;
        due_time: string | null;
      }>();

    if (existing) {
      if (
        existing.title !== summary ||
        existing.due_date !== due_date ||
        existing.due_time !== due_time
      ) {
        await supabase
          .from("tasks")
          .update({ title: summary, due_date, due_time })
          .eq("id", existing.id);
        updated++;
      }
      continue;
    }

    await supabase.from("tasks").insert({
      user_id: userId,
      title: summary,
      life_area: "Pribadi",
      priority: "sedang",
      due_date,
      due_time,
      gcal_event_id: ev.id,
      source: "manual",
      reminder: due_time ? "push" : "none",
    });
    imported++;
  }

  return { imported, updated };
}
