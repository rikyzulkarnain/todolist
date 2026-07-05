"use server";

import { createClient } from "@/lib/supabase/server";
import { createAI } from "./instance";

// Model & dimensi harus konsisten dengan kolom vector(768) di migration 006
// (pola dari fina-app/src/features/ai/embedding.ts).
export async function generateEmbedding(contents: string) {
  const ai = createAI();

  const response = await ai.models.embedContent({
    model: "gemini-embedding-2",
    contents,
    config: {
      outputDimensionality: 768,
    },
  });

  if (
    !response.embeddings ||
    response.embeddings.length === 0 ||
    !response.embeddings[0].values
  ) {
    throw new Error("Failed to generate embedding");
  }

  return response.embeddings[0].values;
}

/**
 * Pencarian semantik task lewat RPC `match_tasks` (pgvector cosine
 * similarity). RLS membatasi hasil ke task milik user yang login.
 */
export async function findEmbedding(
  query: string,
  match_threshold?: number,
  match_count?: number,
) {
  const supabase = await createClient();

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_tasks", {
    query_embedding: queryEmbedding,
    match_threshold: match_threshold || 0.3,
    match_count: match_count || 15,
  });

  if (error) {
    throw new Error("Failed to perform vector search.");
  }

  return data;
}

export type TaskEmbeddingFields = {
  title: string;
  notes?: string | null;
  life_area: string;
  priority: string;
  due_date?: string | null;
  due_time?: string | null;
};

/**
 * Embedding untuk satu task — dipanggil saat task dibuat/diubah (pola
 * handleEmbedding di fina-app). Status sengaja tidak ikut di teks embedding
 * supaya toggle selesai tidak perlu re-embed. Best-effort: bila Gemini gagal
 * (kuota/offline), task tetap tersimpan tanpa embedding.
 */
export async function generateTaskEmbedding(
  fields: TaskEmbeddingFields,
): Promise<number[] | null> {
  try {
    return await generateEmbedding(JSON.stringify(fields));
  } catch {
    return null;
  }
}
