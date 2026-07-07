import { create } from "zustand";

/**
 * Buka/tutup bottom sheet "Tambah tugas" dari mana saja (FAB, empty state
 * Home/Tasks/Calendar) tanpa prop drilling antar layar. `presetDate` (yyyy-MM-dd)
 * dipakai saat dibuka dari Kalender agar tanggal terpilih ikut ter-isi.
 */
type SheetStore = {
  open: boolean;
  presetDate: string | null;
  openSheet: (presetDate?: string) => void;
  closeSheet: () => void;
};

export const useSheetStore = create<SheetStore>((set) => ({
  open: false,
  presetDate: null,
  openSheet: (presetDate) => set({ open: true, presetDate: presetDate ?? null }),
  closeSheet: () => set({ open: false, presetDate: null }),
}));
