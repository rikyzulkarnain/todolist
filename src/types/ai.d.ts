/** Satu item pada kartu "Agenda prioritasmu hari ini" yang disusun AI. */
export type AgendaItem = {
  num: number;
  title: string;
  time: string;
  reason: string;
  task_id?: string;
};

/** Pesan pada percakapan asisten (bentuk UI, bukan bentuk Gemini). */
export type AssistantMessage = {
  role: "user" | "model";
  text: string;
  agenda?: AgendaItem[];
  /** Alur berpikir model (bila mode thinking aktif) — dapat di-minimize di UI. */
  thought?: string;
};

export type ChatMessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "model";
  content: string;
  agenda: AgendaItem[] | null;
  created_at: string;
};
