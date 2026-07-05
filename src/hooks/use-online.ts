"use client";

import { useEffect, useState } from "react";

/**
 * Status koneksi browser. Dipakai untuk banner offline global dan
 * state "AI butuh koneksi internet" di layar asisten.
 */
export function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
