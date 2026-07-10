import { Task } from "@/types/task";
import { create } from "zustand";

/**
 * Task yang baru saja dicentang SELESAI dan sedang menunggu dokumentasi hasil
 * di pop-up "Apa yang sudah kamu lakukan?" (ketik/suara/foto + Multimodal AI).
 * Pop-up bersifat opsional — pengguna boleh melewati.
 */
type CompletionLogStore = {
  task: Task | null;
  promptLog: (task: Task) => void;
  close: () => void;
};

export const useCompletionLogStore = create<CompletionLogStore>((set) => ({
  task: null,
  promptLog: (task) => set({ task }),
  close: () => set({ task: null }),
}));
