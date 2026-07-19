// Service worker AI Life OS — dipakai untuk menampilkan notifikasi reminder
// (ServiceWorkerRegistration.showNotification wajib di Chrome mobile) dan
// menangani klik notifikasi. Disiapkan pula handler `push` untuk web push
// dari server (VAPID) di masa depan; saat ini reminder dijadwalkan di klien.

self.addEventListener("install", (event) => {
  // Aktifkan versi baru tanpa menunggu tab lama tertutup.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Web push dari server (belum diaktifkan — butuh VAPID + cron pengirim).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Reminder", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Reminder AI Life OS";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "aios-reminder",
      data: data.data || {},
      icon: "/icon.svg",
      badge: "/icon.svg",
      requireInteraction: data.requireInteraction ?? false,
    }),
  );
});

// Klik notifikasi → fokuskan tab app yang sudah ada, atau buka baru.
// Untuk notifikasi 'alarm', URL berisi ?alarm=<id> agar tab yang dibuka
// langsung memicu overlay alarm. Karena itu tab yang sudah ada pun
// dinavigasikan ke URL tersebut sebelum difokuskan.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            const navigated =
              "navigate" in client && url
                ? Promise.resolve(client.navigate(url)).catch(() => client)
                : Promise.resolve(client);
            return navigated.then((c) => (c || client).focus());
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
