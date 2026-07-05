export type Mood = 1 | 2 | 3 | 4 | 5;

export type Reflection = {
  id: string;
  user_id: string;
  date: string; // yyyy-MM-dd
  mood: Mood;
  note: string | null;
  created_at: string;
};
