import { ENVIRONMENT } from "@/config/environment";
import {
  baseUrlFromRequest,
  GOOGLE_SCOPE,
  googleRedirectUri,
} from "@/features/google/calendar";
import { getCurrentUser } from "@/lib/supabase/auth";
import { NextResponse } from "next/server";

/** Mulai OAuth Google Calendar: redirect ke consent screen. */
export async function GET(request: Request) {
  const base = baseUrlFromRequest(request);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${base}/login`);
  if (!ENVIRONMENT.googleClientId)
    return NextResponse.redirect(`${base}/profile?gcal=unconfigured`);

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: ENVIRONMENT.googleClientId,
    redirect_uri: googleRedirectUri(base),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  // State untuk proteksi CSRF, diverifikasi di callback.
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https"),
    maxAge: 600,
    path: "/",
  });
  return res;
}
