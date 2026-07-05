-- ============================================================
-- Vector embeddings untuk tasks (pola dari fina-app:
-- "Transactions Table with Vector Embeddings & RLS.sql")
-- ============================================================
-- Ekstensi pgvector sudah diaktifkan di 001-extensions.sql.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS embedding VECTOR(768);

-- ============================================================
-- Semantic Task Matching Function (pola dari fina-app:
-- "Semantic Transaction Matching Function.sql")
-- ============================================================
-- SECURITY INVOKER (default) — RLS "own tasks" tetap berlaku, jadi hasil
-- pencarian otomatis terbatas pada task milik user yang login.
CREATE OR REPLACE FUNCTION match_tasks (
    query_embedding vector(768),
    match_threshold float,
    match_count int
)

RETURNS TABLE (
    id uuid,
    title text,
    notes text,
    life_area text,
    priority text,
    due_date date,
    due_time text,
    status text,
    user_id uuid,
    similarity float
)

LANGUAGE sql STABLE
AS $$
    SELECT
        tasks.id,
        tasks.title,
        tasks.notes,
        tasks.life_area,
        tasks.priority,
        tasks.due_date,
        tasks.due_time,
        tasks.status,
        tasks.user_id,
        1 - (tasks.embedding <=> query_embedding) AS similarity
    FROM tasks
    WHERE tasks.embedding IS NOT NULL
      AND 1 - (tasks.embedding <=> query_embedding) > match_threshold
    ORDER BY tasks.embedding <=> query_embedding
    LIMIT match_count;
$$;
