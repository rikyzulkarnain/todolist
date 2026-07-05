import { ENVIRONMENT } from "@/config/environment";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CreateClientOptions = {
  isAdmin?: boolean;
};

export const createClient = async ({
  isAdmin = false,
}: CreateClientOptions = {}) => {
  const cookieStore = await cookies();
  return createServerClient(
    ENVIRONMENT.supabaseUrl!,
    isAdmin ? ENVIRONMENT.supabaseServiceRoleKey! : ENVIRONMENT.supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
};
