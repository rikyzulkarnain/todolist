import { Priority } from "@/types/task";

// Bobot dipakai untuk mengurutkan "Fokus Hari Ini" & agenda AI.
export const PRIORITIES: Record<
  Priority,
  { label: string; color: string; weight: number }
> = {
  urgent: { label: "Urgent", color: "#DC2626", weight: 4 },
  tinggi: { label: "Tinggi", color: "#EA580C", weight: 3 },
  sedang: { label: "Sedang", color: "#0891B2", weight: 2 },
  rendah: { label: "Rendah", color: "#94A3B8", weight: 1 },
};

export const PRIORITY_KEYS = Object.keys(PRIORITIES) as Priority[];

export function priorityWeight(pr: string): number {
  return PRIORITIES[pr as Priority]?.weight ?? 0;
}
