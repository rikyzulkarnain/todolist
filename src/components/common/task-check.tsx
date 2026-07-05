"use client";

import { cn } from "@/lib/utils";

/**
 * Checkbox bulat-kotak task (rounded 9px, centang putih). Varian `onDark`
 * dipakai di kartu gradien "Fokus Hari Ini".
 */
export default function TaskCheck({
  done,
  onToggle,
  onDark = false,
}: {
  done: boolean;
  onToggle: () => void;
  onDark?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={done ? "Tandai belum selesai" : "Tandai selesai"}
      className={cn(
        "mt-px flex h-6 w-6 flex-none items-center justify-center rounded-[9px] border-[1.7px] p-0 transition",
        onDark
          ? done
            ? "border-white bg-white"
            : "border-white/50 bg-transparent"
          : done
            ? "border-teal bg-teal"
            : "border-[#C4D4D1] bg-transparent",
      )}
    >
      {done && (
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke={onDark ? "#0F766E" : "#fff"}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}
