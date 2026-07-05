import { Task } from "@/types/task";
import { create } from "zustand";

/**
 * Task yang sedang membunyikan alarm (reminder = 'alarm'). Layar penuh
 * AlarmOverlay tampil selama `task` tidak null dan berbunyi sampai
 * di-acknowledge (§11 PRD: fallback web untuk "alarm sampai dimatikan").
 */
type AlarmStore = {
  task: Task | null;
  ring: (task: Task) => void;
  stop: () => void;
};

export const useAlarmStore = create<AlarmStore>((set) => ({
  task: null,
  ring: (task) => set({ task }),
  stop: () => set({ task: null }),
}));
