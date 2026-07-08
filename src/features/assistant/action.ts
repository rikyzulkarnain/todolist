"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  AgendaItem,
  AssistantMessage,
  ChatMessageRow,
  ConversationSummary,
} from "@/types/ai";
import { revalidatePath } from "next/cache";

export type AssistantInit = {
  conversationId: string;
  messages: AssistantMessage[];
};

/** Daftar percakapan user (riwayat), terbaru dulu. */
export async function getConversations(): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<ConversationSummary[]>();

  return data ?? [];
}

/** Buat percakapan baru (kosong) dan kembalikan sebagai init aktif. */
export async function createConversation(): Promise<AssistantInit | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, title: null })
    .select("id")
    .single();
  if (!data) return null;

  revalidatePath("/ai");
  return { conversationId: data.id as string, messages: [] };
}

/** Pesan-pesan pada satu percakapan (untuk membuka riwayat). */
export async function getConversationMessages(
  conversationId: string,
): Promise<AssistantMessage[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<ChatMessageRow[]>();

  return (data ?? []).map((m) => ({
    role: m.role,
    text: m.content,
    agenda: m.agenda ?? undefined,
  }));
}

/** Hapus satu percakapan beserta seluruh pesannya (cascade). */
export async function deleteConversation(
  conversationId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir." };

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/ai");
  return {};
}

export async function getOrCreateConversation(): Promise<AssistantInit | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: null })
      .select("id")
      .single();
    conversation = created;
  }

  if (!conversation) return null;

  const { data: rows } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .returns<ChatMessageRow[]>();

  return {
    conversationId: conversation.id,
    messages: (rows ?? []).map((m) => ({
      role: m.role,
      text: m.content,
      agenda: m.agenda ?? undefined,
    })),
  };
}

/** Simpan satu giliran chat (pesan user + balasan model, termasuk agenda). */
export async function saveTurn(
  conversationId: string,
  userText: string,
  modelText: string,
  agenda?: AgendaItem[],
): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return;

  await supabase.from("chat_messages").insert([
    {
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: userText,
    },
    {
      conversation_id: conversationId,
      user_id: user.id,
      role: "model",
      content: modelText,
      agenda: agenda ?? null,
    },
  ]);

  // Judul otomatis dari pesan pertama (hanya saat judul masih kosong).
  await supabase
    .from("conversations")
    .update({ title: userText.slice(0, 60) })
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .is("title", null);

  revalidatePath("/ai");
}
