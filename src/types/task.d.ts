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

// RRULE ringkas untuk task berulang (§9.2 PRD). null = sekali jalan.
export type RepeatRule = "FREQ=DAILY" | "FREQ=WEEKLY" | "FREQ=MONTHLY";

export type Task = {
  id: string;
  user_id: string;
  goal_id: string | null;
  parent_task_id: string | null;
  title: string;
  notes: string | null;
  life_area: LifeArea;
  priority: Priority;
  due_date: string | null; // yyyy-MM-dd
  due_time: string | null; // HH:mm
  repeat_rule: RepeatRule | null;
  status: TaskStatus;
  completed_at: string | null;
  source: "manual" | "voice" | "ocr" | "ai";
  ai_reason: string | null;
  created_at: string;
  // Diisi getTasks lewat join task_tags → tags (bukan kolom di tabel tasks).
  tags?: Tag[];
  // Subtask (parent_task_id = id task ini). Diisi getTasks di sisi klien.
  subtasks?: Task[];
};

export type Tag = {
  id: string;
  name: string;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  life_area: LifeArea | null;
  status: "active" | "done" | "archived";
  created_at: string;
};
