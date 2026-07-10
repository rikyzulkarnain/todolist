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

// Jenis pengingat saat due_time tiba (§9.4/§11 PRD).
export type ReminderType = "none" | "push" | "alarm";

export type Task = {
  id: string;
  user_id: string;
  goal_id: string | null;
  space_id: string | null;
  parent_task_id: string | null;
  title: string;
  notes: string | null;
  life_area: LifeArea;
  priority: Priority;
  due_date: string | null; // yyyy-MM-dd
  due_time: string | null; // HH:mm
  repeat_rule: RepeatRule | null;
  reminder: ReminderType;
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

// Satu entri log kegiatan pada sebuah task (dokumentasi apa yang sudah
// dilakukan). Kolom mentah dari tabel task_logs.
export type TaskLog = {
  id: string;
  task_id: string;
  user_id: string;
  note: string | null;
  photo_path: string | null;
  audio_path: string | null;
  transcript: string | null;
  created_at: string;
};

// TaskLog yang sudah dilengkapi signed URL (siap tampil di klien).
export type TaskLogView = TaskLog & {
  photoUrl: string | null;
  audioUrl: string | null;
};

export type GoalStatus = "active" | "done" | "archived";

export type Goal = {
  id: string;
  user_id: string;
  parent_goal_id: string | null;
  title: string;
  description: string | null;
  life_area: LifeArea | null;
  status: GoalStatus;
  target_date: string | null;
  created_at: string;
};

/** Goal beserta milestone (anak) & progress task terkait — untuk Goal Tree. */
export type GoalNode = Goal & {
  children: GoalNode[];
  taskDone: number;
  taskTotal: number;
};
