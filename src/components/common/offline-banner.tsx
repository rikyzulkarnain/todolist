"use client";

import { useOnline } from "@/hooks/use-online";

/** Banner abu gelap di atas app saat koneksi hilang. */
export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div className="flex flex-none items-center gap-2 bg-[#3F4B4A] px-4 py-2 text-xs font-semibold text-[#E7EFEE]">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M1 1l22 22" />
        <path d="M16.7 11.6A11 11 0 0 0 12 10.5c-2 0-3.9.5-5.5 1.5" />
        <path d="M5 8.5A16 16 0 0 1 12 6c2.5 0 4.9.6 7 1.6" />
        <path d="M8.5 15.4a6 6 0 0 1 3.5-1.1c1.3 0 2.5.4 3.5 1.1" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </svg>
      Kamu offline — perubahan disimpan lokal &amp; disinkronkan nanti
    </div>
  );
}
