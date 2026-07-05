"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Format audio yang didukung browser sekaligus aman untuk Gemini.
const PREFERRED_MIME = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME.find((m) => MediaRecorder.isTypeSupported(m));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Rekam suara lewat MediaRecorder. Tekan sekali untuk mulai (tombol jadi kotak
 * merah), tekan lagi untuk berhenti — hasil audio dikirim ke `onRecorded`
 * sebagai base64 (multimodal ke Gemini untuk transkrip/pemrosesan akurat).
 */
export function useAudioRecorder({
  onRecorded,
}: {
  onRecorded: (audio: { mimeType: string; base64: string }) => void;
}) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      cleanup();
    };
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Browser ini belum mendukung rekam suara. Ketik saja ya.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        cleanup();
        setRecording(false);
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 1200) {
          toast.error("Rekaman terlalu pendek. Coba lagi ya.");
          return;
        }
        try {
          const base64 = await blobToBase64(blob);
          onRecorded({ mimeType: type.split(";")[0], base64 });
        } catch {
          toast.error("Gagal memproses rekaman.");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Tidak bisa mengakses mikrofon. Izinkan akses lalu coba lagi.");
      cleanup();
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function toggle() {
    if (recording) stop();
    else start();
  }

  return { recording, toggle };
}
