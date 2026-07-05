-- Pencarian semantik long-term memory (RAG, PRD §6.3) — pola sama dengan
-- match_tasks (006). SECURITY INVOKER (default) → RLS "own ai_memory" berlaku,
-- hasil otomatis terbatas pada memori milik user yang login.
CREATE OR REPLACE FUNCTION match_ai_memory (
    query_embedding vector(768),
    match_threshold float,
    match_count int
)

RETURNS TABLE (
    id uuid,
    content text,
    kind text,
    source_ref text,
    user_id uuid,
    similarity float
)

LANGUAGE sql STABLE
AS $$
    SELECT
        ai_memory.id,
        ai_memory.content,
        ai_memory.kind,
        ai_memory.source_ref,
        ai_memory.user_id,
        1 - (ai_memory.embedding <=> query_embedding) AS similarity
    FROM ai_memory
    WHERE ai_memory.embedding IS NOT NULL
      AND 1 - (ai_memory.embedding <=> query_embedding) > match_threshold
    ORDER BY ai_memory.embedding <=> query_embedding
    LIMIT match_count;
$$;
