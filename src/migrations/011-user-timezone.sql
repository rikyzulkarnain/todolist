-- Timezone per user (IANA, mis. 'Asia/Jakarta'). Dipakai untuk menghitung
-- "hari ini" & jam di server (weekly review, proactive nudge, konteks AI) agar
-- benar lintas zona — due_time task tetap wall-clock lokal.
alter table public.profiles
  add column if not exists timezone text;
