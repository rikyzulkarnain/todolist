"use client";

import { signOutAction } from "@/features/auth/action";
import {
  disconnectGoogle,
  getGoogleStatus,
  GoogleStatus,
  syncGoogleNow,
} from "@/features/google/action";
import { QuotaInfo } from "@/features/profile/action";
import {
  createTelegramLink,
  getTelegramStatus,
  TelegramStatus,
  unlinkTelegram,
} from "@/features/telegram/action";
import {
  ensureNotificationPermission,
  permissionState,
  registerServiceWorker,
} from "@/lib/notifications";
import { subscribeToPush } from "@/lib/push";
import { cn } from "@/lib/utils";
import { Profile } from "@/types/profile";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ProfileView({
  profile,
  quota,
}: {
  profile: Profile;
  quota: QuotaInfo;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [tg, setTg] = useState<TelegramStatus | null>(null);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [intgBusy, setIntgBusy] = useState(false);

  const name = profile.name ?? "Pengguna";
  const initial = name.charAt(0).toUpperCase();
  const quotaPct = Math.min(100, Math.round((quota.used / quota.limit) * 100));

  useEffect(() => {
    setPerm(permissionState());
    registerServiceWorker();
    getTelegramStatus().then(setTg);
    getGoogleStatus().then(setGoogle);
  }, []);

  // Umpan balik setelah kembali dari OAuth Google (?gcal=...).
  useEffect(() => {
    const g = searchParams.get("gcal");
    if (!g) return;
    if (g === "connected") {
      toast.success("Google Calendar terhubung — mengimpor event…");
      getGoogleStatus().then(setGoogle);
      // Impor event berjalan di server (after); segarkan task sebentar kemudian.
      setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        3000,
      );
    } else if (g === "norefresh")
      toast.error("Coba lagi & pilih 'izinkan' — token refresh tidak diterima.");
    else if (g === "unconfigured")
      toast.error("Google Calendar belum dikonfigurasi (env).");
    else if (g !== "connected") toast.error("Gagal menghubungkan Google Calendar.");
    router.replace("/profile", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectTelegram() {
    setIntgBusy(true);
    try {
      const res = await createTelegramLink();
      if (res.error || !res.url) {
        toast.error(res.error ?? "Gagal membuat tautan Telegram.");
        return;
      }
      window.open(res.url, "_blank");
      toast("Tekan Start di Telegram, lalu kembali ke sini.");
    } finally {
      setIntgBusy(false);
    }
  }

  async function disconnectTelegram() {
    setIntgBusy(true);
    try {
      await unlinkTelegram();
      setTg({ linked: false, username: null });
      toast.success("Telegram diputus");
    } finally {
      setIntgBusy(false);
    }
  }

  async function disconnectGoogleCal() {
    setIntgBusy(true);
    try {
      await disconnectGoogle();
      setGoogle((g) => (g ? { ...g, connected: false } : g));
      toast.success("Google Calendar diputus");
    } finally {
      setIntgBusy(false);
    }
  }

  async function syncGoogleCal() {
    setIntgBusy(true);
    try {
      const res = await syncGoogleNow();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(
        `Sinkron selesai — ${res.imported} baru, ${res.updated} diperbarui`,
      );
    } finally {
      setIntgBusy(false);
    }
  }

  async function enableNotifications() {
    const ok = await ensureNotificationPermission();
    setPerm(permissionState());
    if (ok) {
      await registerServiceWorker();
      // Berlangganan Web Push (best-effort; hanya jika VAPID key dikonfigurasi).
      await subscribeToPush();
      toast.success("Notifikasi aktif — reminder task akan muncul tepat waktu");
    } else {
      toast.error(
        "Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser.",
      );
    }
  }

  const menuRows: { label: string; value: string; href?: string }[] = [
    { label: "Goals & milestone", value: "", href: "/goals" },
    { label: "Couple / Family Mode", value: "Berbagi", href: "/couple" },
    { label: "Jam produktif", value: profile.productive_time ?? "-" },
    { label: "Bahasa", value: "Indonesia" },
    { label: "Privasi & data", value: "" },
    { label: "Hapus akun & datamu", value: "" },
  ];

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await signOutAction();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-[22px] pb-[90px]">
      <div className="text-ink text-[22px] font-extrabold tracking-[-0.4px]">
        Profil
      </div>

      {/* kartu identitas */}
      <div className="border-line flex items-center gap-3.5 rounded-[18px] border bg-white p-[18px]">
        <div className="bg-teal flex h-14 w-14 flex-none items-center justify-center rounded-full text-[22px] font-extrabold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ink truncate text-base font-extrabold">
            {name}
          </div>
          <div className="text-mute truncate text-[12.5px]">
            {profile.email}
          </div>
        </div>
        <span className="text-slate rounded-lg bg-[#EDF1F0] px-2.5 py-[5px] text-[11px] font-extrabold uppercase">
          {profile.plan}
        </span>
      </div>

      {/* kuota AI */}
      <div className="border-line rounded-[18px] border bg-white px-[18px] py-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-ink text-[13px] font-extrabold">
            Kuota AI harian
          </div>
          <div className="text-slate text-xs font-bold">
            {quota.used}/{quota.limit} kuota harian gratis
          </div>
        </div>
        <div className="bg-seg h-2 overflow-hidden rounded-full">
          <div
            className="bg-teal h-full rounded-full transition-[width] duration-500"
            style={{ width: `${quotaPct}%` }}
          />
        </div>
        <div className="text-mute-2 mt-2 text-[11.5px]">
          Kuota di-reset setiap pukul 00.00
        </div>
      </div>

      {/* notifikasi */}
      <div className="border-line flex items-center gap-3 rounded-[18px] border bg-white px-[18px] py-4">
        <div className="bg-mint flex h-10 w-10 flex-none items-center justify-center rounded-xl">
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0F766E"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ink-2 text-sm font-bold">Notifikasi reminder</div>
          <div className="text-mute mt-px text-[12px]">
            {perm === "granted"
              ? "Aktif — reminder task muncul tepat waktu"
              : perm === "denied"
                ? "Diblokir — aktifkan lewat pengaturan browser"
                : perm === "unsupported"
                  ? "Browser ini tidak mendukung notifikasi"
                  : "Izinkan agar reminder bisa berbunyi"}
          </div>
        </div>
        {perm !== "granted" && perm !== "unsupported" && (
          <button
            onClick={enableNotifications}
            className="bg-teal hover:bg-teal-deep h-9 flex-none rounded-[10px] px-3.5 text-[12.5px] font-bold text-white transition"
          >
            Aktifkan
          </button>
        )}
      </div>

      {/* integrasi */}
      <div className="border-line overflow-hidden rounded-[18px] border bg-white">
        {/* Telegram */}
        <div className="border-line-soft flex items-center gap-3 border-b px-[18px] py-3.5">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#E7F3FB]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9">
              <path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 9-8.1c.4-.3-.1-.5-.6-.2L6.4 13.3l-4.8-1.5c-1-.3-1-.9.2-1.4L20.6 3c.9-.3 1.6.2 1.3 1.3Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-ink-2 text-sm font-bold">Telegram</div>
            <div className="text-mute text-[12px]">
              {tg?.linked
                ? `Terhubung${tg.username ? " · @" + tg.username : ""}`
                : "Buat task & terima reminder lewat bot"}
            </div>
          </div>
          <button
            onClick={tg?.linked ? disconnectTelegram : connectTelegram}
            disabled={intgBusy}
            className={cn(
              "h-9 flex-none rounded-[10px] px-3.5 text-[12.5px] font-bold transition disabled:opacity-50",
              tg?.linked
                ? "text-danger border-danger-line border bg-white"
                : "bg-teal hover:bg-teal-deep text-white",
            )}
          >
            {tg?.linked ? "Putus" : "Hubungkan"}
          </button>
        </div>
        {/* Google Calendar */}
        <div className="flex items-center gap-3 px-[18px] py-3.5">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#FDECEC]">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-ink-2 text-sm font-bold">Google Calendar</div>
            <div className="text-mute text-[12px]">
              {google?.connected
                ? "Task bertanggal tersinkron"
                : google && !google.configured
                  ? "Belum dikonfigurasi"
                  : "Sinkronkan task ke kalendermu"}
            </div>
          </div>
          {google?.connected ? (
            <div className="flex flex-none gap-1.5">
              <button
                onClick={syncGoogleCal}
                disabled={intgBusy}
                className="bg-teal hover:bg-teal-deep h-9 rounded-[10px] px-3 text-[12.5px] font-bold text-white transition disabled:opacity-50"
              >
                {intgBusy ? "…" : "Sinkron"}
              </button>
              <button
                onClick={disconnectGoogleCal}
                disabled={intgBusy}
                className="text-danger border-danger-line h-9 rounded-[10px] border bg-white px-3 text-[12.5px] font-bold transition disabled:opacity-50"
              >
                Putus
              </button>
            </div>
          ) : (
            <a
              href="/api/google/connect"
              className={cn(
                "bg-teal hover:bg-teal-deep flex h-9 flex-none items-center rounded-[10px] px-3.5 text-[12.5px] font-bold text-white transition",
                google && !google.configured && "pointer-events-none opacity-40",
              )}
            >
              Hubungkan
            </a>
          )}
        </div>
      </div>

      {/* upgrade */}
      <div className="rounded-[18px] bg-[linear-gradient(150deg,#0F766E,#0A5750)] p-[18px] text-white">
        <div className="text-[15px] font-extrabold">Upgrade ke Pro</div>
        <div className="mt-[5px] text-[12.5px] leading-[1.55] text-[#B9E6E0] text-pretty">
          AI tanpa batas, memori jangka panjang, mode berbagi Couple &amp;
          Family, OCR dan voice tanpa batas.
        </div>
        <button
          onClick={() => toast("Paket Pro — segera hadir")}
          className="text-teal mt-3.5 h-10 rounded-[11px] bg-white px-[18px] text-[13px] font-extrabold hover:opacity-90"
        >
          Lihat paket
        </button>
      </div>

      {/* menu */}
      <div className="border-line overflow-hidden rounded-[18px] border bg-white">
        {menuRows.map((r) => (
          <button
            key={r.label}
            onClick={() =>
              r.href
                ? router.push(r.href)
                : toast(`Layar "${r.label}" — segera hadir setelah MVP`)
            }
            className="border-line-soft hover:bg-soft flex min-h-[52px] w-full items-center gap-3 border-b bg-white px-[18px] text-left last:border-b-0"
          >
            <span className="text-ink-2 flex-1 text-sm font-semibold">
              {r.label}
            </span>
            <span className="text-mute-2 text-[12.5px] font-semibold">
              {r.value}
            </span>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#B7C6C3"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      <button
        onClick={logout}
        disabled={busy}
        className="border-danger-line text-danger h-[50px] rounded-[14px] border-[1.5px] bg-white text-sm font-bold transition hover:bg-[#FBF3F2] disabled:opacity-60"
      >
        {busy ? "Keluar…" : "Keluar"}
      </button>
    </div>
  );
}
