import { ENVIRONMENT } from "@/config/environment";
import { GOOGLE_SCOPE, googleRedirectUri } from "@/features/google/calendar";
import { getCurrentUser } from "@/lib/supabase/auth";
import { NextResponse } from "next/server";

/** Mulai OAuth Google Calendar: redirect ke consent screen. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.redirect(`${ENVIRONMENT.appUrl}/login`);
  if (!ENVIRONMENT.googleClientId)
    return NextResponse.redirect(`${ENVIRONMENT.appUrl}/profile?gcal=unconfigured`);

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: ENVIRONMENT.googleClientId,
    redirect_uri: googleRedirectUri(),
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
    secure: true,
    maxAge: 600,
    path: "/",
  });
  return res;
}
