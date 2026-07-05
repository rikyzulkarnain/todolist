"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const INACTIVE = "#94A3B8";
const ACTIVE = "#0F766E";

function navColor(pathname: string, href: string) {
  return pathname.startsWith(href) ? ACTIVE : INACTIVE;
}

/** Bottom navigation 5 tab — tombol AI menonjol di tengah (PRD §13). */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="border-line relative z-10 flex flex-none items-stretch border-t bg-white px-2 pt-1.5 pb-2.5">
      <Link
        href="/home"
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[3px]"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: navColor(pathname, "/home") }}
        >
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
        <span
          className="text-[10px] font-bold"
          style={{ color: navColor(pathname, "/home") }}
        >
          Home
        </span>
      </Link>

      <Link
        href="/calendar"
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[3px]"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: navColor(pathname, "/calendar") }}
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
        <span
          className="text-[10px] font-bold"
          style={{ color: navColor(pathname, "/calendar") }}
        >
          Kalender
        </span>
      </Link>

      <div className="relative flex flex-1 items-center justify-center">
        <Link
          href="/ai"
          className={cn(
            "bg-teal hover:bg-teal-deep flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full shadow-[0_8px_20px_rgba(15,118,110,.42)] transition active:scale-[.94]",
          )}
        >
          <svg
            width="25"
            height="25"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
            <circle cx="19" cy="5" r="1.4" fill="#fff" stroke="none" />
          </svg>
        </Link>
      </div>

      <Link
        href="/tasks"
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[3px]"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: navColor(pathname, "/tasks") }}
        >
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        <span
          className="text-[10px] font-bold"
          style={{ color: navColor(pathname, "/tasks") }}
        >
          Tugas
        </span>
      </Link>

      <Link
        href="/profile"
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-[3px]"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: navColor(pathname, "/profile") }}
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
        <span
          className="text-[10px] font-bold"
          style={{ color: navColor(pathname, "/profile") }}
        >
          Profil
        </span>
      </Link>
    </div>
  );
}
