"use server";

import { ENVIRONMENT } from "@/config/environment";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type TelegramStatus = {
  linked: boolean;
  username: string | null;
};

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { linked: false, username: null };

  const { data } = await supabase
    .from("telegram_links")
    .select("linked, username")
    .eq("user_id", user.id)
    .maybeSingle<{ linked: boolean; username: string | null }>();

  return { linked: data?.linked ?? false, username: data?.username ?? null };
}

/** Nama bot (untuk deep link) dari Telegram getMe — server-side saja. */
async function getBotUsername(): Promise<string | null> {
  const token = ENVIRONMENT.telegramBotToken;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const json = await res.json();
    return json?.result?.username ?? null;
  } catch {
    return null;
  }
}

/**
 * Buat/ambil token tautan lalu kembalikan deep link Telegram. Pengguna membuka
 * link → menekan Start → bot menerima `/start <token>` dan menautkan chat.
 */
export async function createTelegramLink(): Promise<{
  error?: string;
  url?: string;
}> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };
  if (!ENVIRONMENT.telegramBotToken)
    return { error: "Integrasi Telegram belum dikonfigurasi." };

  const username = await getBotUsername();
  if (!username) return { error: "Tidak bisa menghubungi bot Telegram." };

  const { data: existing } = await supabase
    .from("telegram_links")
    .select("link_token")
    .eq("user_id", user.id)
    .maybeSingle<{ link_token: string }>();

  let token = existing?.link_token;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase
      .from("telegram_links")
      .insert({ user_id: user.id, link_token: token });
    if (error) return { error: error.message };
  }

  return { url: `https://t.me/${username}?start=${token}` };
}

export async function unlinkTelegram(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase
    .from("telegram_links")
    .delete()
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}
