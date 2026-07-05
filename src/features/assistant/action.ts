"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { AgendaItem, AssistantMessage, ChatMessageRow } from "@/types/ai";

export type AssistantInit = {
  conversationId: string;
  messages: AssistantMessage[];
};

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
      .insert({ user_id: user.id, title: "Asisten" })
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
}
