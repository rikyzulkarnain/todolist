import { LifeArea } from "@/types/task";

// 7 Life Area beserta warna label (mengikuti design system AI Life OS).
export const LIFE_AREAS: Record<LifeArea, string> = {
  Karier: "#6366F1",
  Kesehatan: "#10B981",
  Keuangan: "#F59E0B",
  Keluarga: "#EC4899",
  Ibadah: "#8B5CF6",
  Belajar: "#0EA5E9",
  Pribadi: "#64748B",
};

export const LIFE_AREA_NAMES = Object.keys(LIFE_AREAS) as LifeArea[];

export function areaColor(area: string): string {
  return LIFE_AREAS[area as LifeArea] ?? LIFE_AREAS.Pribadi;
}

/** rgba() dari warna hex area untuk background chip yang lembut. */
export function alphaColor(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
