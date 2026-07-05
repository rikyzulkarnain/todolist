"use client";

import { ENVIRONMENT } from "@/config/environment";
import { savePushSubscription } from "@/features/push/action";
import { registerServiceWorker } from "./notifications";

// VAPID public key (base64url) → Uint8Array untuk applicationServerKey.
// Backing ArrayBuffer eksplisit agar cocok dengan tipe BufferSource.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushConfigured(): boolean {
  return Boolean(ENVIRONMENT.vapidPublicKey);
}

/**
 * Berlangganan Web Push dan menyimpan subscription ke Supabase, agar Edge
 * Function `send-reminders` bisa mengirim notifikasi walau app tertutup.
 * Best-effort: hanya berjalan bila VAPID public key tersedia & izin granted.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushConfigured()) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "granted")
    return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;

  try {
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          ENVIRONMENT.vapidPublicKey!,
        ),
      }));

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const res = await savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    });
    return !res.error;
  } catch {
    return false;
  }
}
