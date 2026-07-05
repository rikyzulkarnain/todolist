"use server";

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embedding";

export type MemoryKind = "habit" | "preference" | "event" | "insight";

export type MemoryMatch = {
  id: string;
  content: string;
  kind: MemoryKind | null;
  similarity: number;
};

/**
 * Simpan satu memori jangka panjang (RAG, PRD §6.3): teks + embedding di
 * ai_memory. Best-effort — kalau embedding gagal (kuota/offline), dilewati.
 */
export async function saveMemory(input: {
  content: string;
  kind: MemoryKind;
  sourceRef?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return {};

  const content = input.content.trim();
  if (!content) return {};

  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(content);
  } catch {
    return {}; // tanpa embedding, memori tidak berguna untuk RAG — lewati
  }

  const { error } = await supabase.from("ai_memory").insert({
    user_id: user.id,
    content,
    kind: input.kind,
    source_ref: input.sourceRef ?? null,
    embedding,
  });
  if (error) return { error: error.message };
  return {};
}

/**
 * Ambil top-k memori paling relevan dengan `query` lewat pencarian vektor
 * (RPC match_ai_memory). RLS membatasi ke memori milik user yang login.
 */
export async function findMemories(
  query: string,
  k = 4,
): Promise<MemoryMatch[]> {
  const clean = query.trim();
  if (!clean) return [];

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    const queryEmbedding = await generateEmbedding(clean);
    const { data, error } = await supabase.rpc("match_ai_memory", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: k,
    });
    if (error) return [];
    return (data ?? []) as MemoryMatch[];
  } catch {
    return [];
  }
}
