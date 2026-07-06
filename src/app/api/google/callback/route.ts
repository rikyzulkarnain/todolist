import { ENVIRONMENT } from "@/config/environment";
import {
  baseUrlFromRequest,
  googleRedirectUri,
  pullGoogleCalendarEvents,
} from "@/features/google/calendar";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

/** Callback OAuth Google: tukar code → token, simpan, kembali ke Profil. */
export async function GET(request: NextRequest) {
  const base = baseUrlFromRequest(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("g_oauth_state")?.value;

  const back = (status: string) =>
    NextResponse.redirect(`${base}/profile?gcal=${status}`);

  if (url.searchParams.get("error")) return back("denied");
  if (!code || !state || state !== cookieState) return back("error");

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${base}/login`);

  // Tukar authorization code dengan token.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENVIRONMENT.googleClientId!,
      client_secret: ENVIRONMENT.googleClientSecret!,
      code,
      redirect_uri: googleRedirectUri(base),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return back("error");

  const token = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  // refresh_token hanya diberikan pada consent pertama; wajib ada untuk sync.
  if (!token.refresh_token) return back("norefresh");

  const expiry = new Date(Date.now() + token.expires_in * 1000).toISOString();
  const supabase = createServiceClient();
  const { error } = await supabase.from("google_calendar_links").upsert(
    {
      user_id: user.id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry,
      calendar_id: "primary",
    },
    { onConflict: "user_id" },
  );
  if (error) return back("error");

  // Impor event yang sudah ada di Google Calendar ke app (arah Google → app).
  after(() => pullGoogleCalendarEvents(user.id));

  const res = back("connected");
  res.cookies.delete("g_oauth_state");
  return res;
}
