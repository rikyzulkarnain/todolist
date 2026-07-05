import { Task } from "@/types/task";
import { create } from "zustand";

/**
 * Task yang sedang dibuka di bottom sheet "Detail tugas" (tap kartu task di
 * Home/Tasks/Calendar). Menyimpan task penuh agar sheet bisa langsung render
 * tanpa fetch ulang; klien me-refresh dari cache react-query saat berubah.
 */
type TaskDetailStore = {
  task: Task | null;
  openTask: (task: Task) => void;
  closeTask: () => void;
};

export const useTaskDetailStore = create<TaskDetailStore>((set) => ({
  task: null,
  openTask: (task) => set({ task }),
  closeTask: () => set({ task: null }),
}));
