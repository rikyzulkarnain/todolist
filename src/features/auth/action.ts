"use server";

import { createClient } from "@/lib/supabase/server";
import { magicLinkSchema } from "@/validations/auth-validation";
import { revalidatePath } from "next/cache";

type ActionResult = { error?: string; message?: string };

/** Kirim magic link ke email; user baru otomatis dibuatkan akun + profil. */
export async function sendMagicLinkAction(input: {
  email: string;
  redirectTo: string;
}): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse({ email: input.email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: input.redirectTo,
    },
  });

  if (error) return { error: error.message };
  return {
    message: "Magic link terkirim! Cek inbox emailmu lalu klik tautannya.",
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
