import { type NextRequest } from "next/server";
import { supabaseProxy } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await supabaseProxy(request);
}

export const config = {
  matcher: [
    // Kecualikan aset PWA (sw.js, manifest) & file statis dari auth redirect —
    // service worker yang di-redirect ke /login tidak akan bisa terdaftar.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
