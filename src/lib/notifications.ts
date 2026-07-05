"use client";

// Helper notifikasi sisi klien. Reminder dijadwalkan di klien (foreground)
// lalu ditampilkan lewat Service Worker — pola paling andal untuk PWA tanpa
// server push. Web push dari server (VAPID + cron) bisa ditambahkan nanti;
// service worker sudah menyiapkan handler `push`.

let swRegistration: ServiceWorkerRegistration | null = null;

export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window
  );
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/** Daftarkan service worker sekali; aman dipanggil berulang. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationsSupported()) return null;
  if (swRegistration) return swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js");
    return swRegistration;
  } catch {
    return null;
  }
}

/** Minta izin notifikasi bila belum ditentukan. Kembalikan true bila granted. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/** Tampilkan notifikasi reminder lewat service worker (fallback ke Notification). */
export async function showTaskNotification(
  title: string,
  options: { body?: string; tag?: string; requireInteraction?: boolean } = {},
): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted")
    return;

  const reg = swRegistration ?? (await registerServiceWorker());
  const payload: NotificationOptions = {
    body: options.body,
    tag: options.tag ?? "aios-reminder",
    icon: "/icon.svg",
    badge: "/icon.svg",
    requireInteraction: options.requireInteraction ?? false,
    data: { url: "/home" },
  };

  if (reg) {
    await reg.showNotification(title, payload);
    return;
  }
  // Fallback (desktop): konstruktor Notification bila SW tak tersedia.
  try {
    new Notification(title, payload);
  } catch {
    /* diabaikan */
  }
}
