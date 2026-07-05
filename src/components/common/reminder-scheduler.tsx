"use client";

import { getTasks } from "@/features/tasks/action";
import { registerServiceWorker, showTaskNotification } from "@/lib/notifications";
import { subscribeToPush } from "@/lib/push";
import { useAlarmStore } from "@/stores/alarm-store";
import { Task } from "@/types/task";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useRef } from "react";

// Alarm/notif tetap dibunyikan jika due_time baru saja lewat saat app dibuka
// (mis. baru login), tapi tidak untuk yang sudah lewat lama.
const GRACE_MS = 2 * 60 * 1000;

function firedKey(taskId: string, date: string): string {
  return `aios-fired-${taskId}-${date}`;
}

/**
 * Penjadwal reminder foreground: selama app terbuka, memasang timer untuk tiap
 * task berwaktu hari ini (reminder != 'none') dan, saat due_time tiba,
 * menampilkan notifikasi (push) atau membunyikan alarm layar penuh (alarm).
 *
 * Catatan: ini bekerja selama PWA berjalan. Notifikasi saat app tertutup total
 * butuh web push dari server (VAPID + cron) — service worker sudah menyiapkan
 * handler `push`-nya untuk pengembangan berikutnya.
 */
export default function ReminderScheduler() {
  const ring = useAlarmStore((s) => s.ring);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks(),
  });

  useEffect(() => {
    registerServiceWorker();
    // Pastikan langganan Web Push tersimpan untuk user yang izinnya sudah aktif
    // (mis. sesi berikutnya) — agar reminder tetap terkirim saat app tertutup.
    subscribeToPush();
  }, []);

  useEffect(() => {
    // Reset semua timer setiap daftar task berubah.
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const today = format(new Date(), "yyyy-MM-dd");
    const now = Date.now();

    function fire(task: Task) {
      const key = firedKey(task.id, today);
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");

      if (task.reminder === "alarm") {
        ring(task);
        showTaskNotification("⏰ Alarm — " + task.title, {
          body: `${task.life_area} · ${task.due_time}`,
          tag: `alarm-${task.id}`,
          requireInteraction: true,
        });
      } else {
        showTaskNotification("Pengingat: " + task.title, {
          body: task.due_time
            ? `Jadwal ${task.due_time} · ${task.life_area}`
            : task.life_area,
          tag: `push-${task.id}`,
        });
      }
    }

    for (const task of tasks) {
      if (
        task.due_date !== today ||
        task.status === "done" ||
        task.reminder === "none" ||
        !task.due_time
      )
        continue;

      const [h, m] = task.due_time.split(":").map(Number);
      const fireAt = new Date();
      fireAt.setHours(h, m, 0, 0);
      const delta = fireAt.getTime() - now;

      if (delta > 0) {
        timers.current.push(setTimeout(() => fire(task), delta));
      } else if (delta > -GRACE_MS) {
        // Baru saja lewat (mis. app baru dibuka) — bunyikan sekarang.
        fire(task);
      }
    }

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [tasks, ring]);

  return null;
}
