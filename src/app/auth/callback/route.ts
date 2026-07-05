import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Target redirect magic link & OAuth (Google). Menukar PKCE code menjadi
// session, lalu mengarahkan ke onboarding (user baru) atau home.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  let destination = next ?? "/home";
  if (!next) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();
      destination = profile?.onboarding_completed ? "/home" : "/onboarding";
    }
  }

  // Di belakang proxy/load balancer, host asli ada di x-forwarded-host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  if (!isLocal && forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${destination}`);
  }
  return NextResponse.redirect(`${origin}${destination}`);
}
