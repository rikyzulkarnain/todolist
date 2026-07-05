export type LifeArea =
  | "Karier"
  | "Kesehatan"
  | "Keuangan"
  | "Keluarga"
  | "Ibadah"
  | "Belajar"
  | "Pribadi";

export type Priority = "urgent" | "tinggi" | "sedang" | "rendah";

export type TaskStatus = "todo" | "done";

export type Task = {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  notes: string | null;
  life_area: LifeArea;
  priority: Priority;
  due_date: string | null; // yyyy-MM-dd
  due_time: string | null; // HH:mm
  status: TaskStatus;
  completed_at: string | null;
  source: "manual" | "voice" | "ocr" | "ai";
  ai_reason: string | null;
  created_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  life_area: LifeArea | null;
  status: "active" | "done" | "archived";
  created_at: string;
};
