import { create } from "zustand";

/**
 * Buka/tutup bottom sheet "Tambah tugas" dari mana saja (FAB, empty state
 * Home/Tasks/Calendar) tanpa prop drilling antar layar.
 */
type SheetStore = {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
};

export const useSheetStore = create<SheetStore>((set) => ({
  open: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
}));
